import fs from "fs/promises";
import path from "path";
import os from "os";
import { RetrievedMedia, InstagramErrorCode } from "@/types";
import { validateInstagramUrl } from "./validator";
import { generateId } from "@/lib/utils";
import { InstagramAuthProvider, defaultInstagramAuthProvider } from "./auth";
import { defaultBrowserMediaRetriever } from "./browser-retriever";

export interface MediaRetriever {
  retrieve(url: string, authProvider?: InstagramAuthProvider): Promise<RetrievedMedia>;
}

export function createStructuredError(message: string, code: InstagramErrorCode): Error & { code: InstagramErrorCode } {
  const err = new Error(message) as Error & { code: InstagramErrorCode };
  err.code = code;
  return err;
}

// Modular Parser 1: Parse GraphQL / xdt_shortcode_media payload
export function parseXdtGraphQL(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;

  const media =
    (obj.data as Record<string, unknown>)?.xdt_shortcode_media ||
    (obj.data as Record<string, unknown>)?.shortcode_media ||
    (obj.items as Array<Record<string, unknown>>)?.[0];

  if (media && typeof media === "object") {
    const videoUrl =
      (media as Record<string, unknown>).video_url ||
      ((media as Record<string, unknown>).video_versions as Array<{ url: string }>)?.[0]?.url;

    if (typeof videoUrl === "string" && videoUrl.startsWith("http")) {
      return videoUrl.replace(/\\u0026/g, "&").replace(/\\/g, "");
    }
  }

  return null;
}

// Modular Parser 2: Parse embedded script JSON objects from HTML
export function parseEmbeddedJSON(html: string): string | null {
  if (!html) return null;

  const videoMatch =
    html.match(/"video_url"\s*:\s*"([^"]+)"/i) ||
    html.match(/video_url\\":\\"(http[^\\]+)\\"/i) ||
    html.match(/"video_versions"\s*:\s*\[\s*\{\s*"url"\s*:\s*"([^"]+)"/i);

  if (videoMatch && videoMatch[1]) {
    return videoMatch[1].replace(/\\u0026/g, "&").replace(/\\/g, "");
  }

  return null;
}

// Modular Parser 3: Parse DOM OpenGraph Meta Tags
export function parseDOMMetaTags(html: string): string | null {
  if (!html) return null;

  const ogVideoMatch =
    html.match(/<meta\s+property="og:video"\s+content="([^"]+)"/i) ||
    html.match(/<meta\s+property="og:video:secure_url"\s+content="([^"]+)"/i) ||
    html.match(/src="([^"]+\.mp4[^"]*)"/i);

  if (ogVideoMatch && ogVideoMatch[1]) {
    return ogVideoMatch[1].replace(/\\u0026/g, "&").replace(/\\/g, "");
  }

  return null;
}

// Modular Parser 4: Parse requireLazy or ServerJS script state payloads
export function parseScriptState(html: string): string | null {
  if (!html) return null;

  const mp4Regex = /(https?:\\?\\?\/\\?\\?\/[^\s"'<>]+\.mp4[^\s"'<>]*)/gi;
  const match = mp4Regex.exec(html);

  if (match && match[1]) {
    return match[1].replace(/\\u0026/g, "&").replace(/\\/g, "");
  }

  return null;
}

export class PublicInstagramMediaRetriever implements MediaRetriever {
  async retrieve(
    url: string,
    authProvider: InstagramAuthProvider = defaultInstagramAuthProvider
  ): Promise<RetrievedMedia> {
    const validation = validateInstagramUrl(url);
    if (!validation.isValid || !validation.canonicalUrl || !validation.mediaId) {
      throw createStructuredError(
        validation.error || "Invalid Instagram URL format.",
        "INVALID_INSTAGRAM_URL"
      );
    }

    const canonicalUrl = validation.canonicalUrl;
    const mediaId = validation.mediaId;
    let videoStreamUrl: string | null = null;

    const authContext = await authProvider.getAuthenticatedContext();

    // Handle explicit authentication failure states upfront
    if (authContext.isAuthEnabled) {
      if (authContext.status === "auth_expired") {
        throw createStructuredError(
          "Instagram dummy account session has expired. Please update session credentials in .env.local.",
          "INSTAGRAM_AUTH_EXPIRED"
        );
      }
      if (authContext.status === "checkpoint_required") {
        throw createStructuredError(
          "Instagram account checkpoint/challenge required.",
          "INSTAGRAM_CHECKPOINT_REQUIRED"
        );
      }
      if (authContext.status === "rate_limited") {
        throw createStructuredError(
          "Instagram rate limit reached for authenticated requests. Please try again later.",
          "INSTAGRAM_RATE_LIMITED"
        );
      }
    }

    // Tier 1: Official Meta/Instagram API (if configured)
    if (process.env.META_GRAPH_API_TOKEN) {
      try {
        const apiUrl = `https://graph.facebook.com/v19.0/${mediaId}?fields=media_type,media_url&access_token=${process.env.META_GRAPH_API_TOKEN}`;
        const apiRes = await fetch(apiUrl);
        if (apiRes.ok) {
          const apiData = await apiRes.json();
          if (apiData.media_type === "VIDEO" && apiData.media_url) {
            videoStreamUrl = apiData.media_url;
          }
        }
      } catch {
        // Fallback to Tier 2
      }
    }

    // Tier 2: Authenticated Web HTTP Retrieval
    if (!videoStreamUrl && authContext.isAuthEnabled) {
      try {
        const res = await fetch(canonicalUrl, {
          headers: authContext.headers,
        });

        if (res.status === 404) {
          throw createStructuredError(
            "The requested Instagram Reel could not be found or has been deleted.",
            "REEL_UNAVAILABLE"
          );
        }

        if (res.status === 401 || res.status === 403) {
          throw createStructuredError(
            "Authenticated session is unauthorized or content is restricted.",
            "INSTAGRAM_AUTH_EXPIRED"
          );
        }

        if (res.status === 429) {
          throw createStructuredError(
            "Instagram rate limit exceeded.",
            "INSTAGRAM_RATE_LIMITED"
          );
        }

        if (res.url.includes("checkpoint") || res.url.includes("challenge")) {
          throw createStructuredError(
            "Instagram checkpoint challenge required.",
            "INSTAGRAM_CHECKPOINT_REQUIRED"
          );
        }

        if (res.ok) {
          const html = await res.text();

          if (html.includes("This Account is Private") || html.includes("Private Account")) {
            throw createStructuredError(
              "This Instagram video belongs to a private account that is not accessible.",
              "PRIVATE_CONTENT_UNAVAILABLE"
            );
          }

          videoStreamUrl =
            parseEmbeddedJSON(html) ||
            parseDOMMetaTags(html) ||
            parseScriptState(html);
        }
      } catch (err) {
        if ((err as { code?: string }).code) throw err;
      }
    }

    // Tier 3: Unauthenticated Public HTTP Fallback
    if (!videoStreamUrl) {
      try {
        const embedUrl = `${canonicalUrl.replace(/\/$/, "")}/embed/captioned/`;
        const res = await fetch(embedUrl, {
          headers: authContext.headers,
        });

        if (res.ok) {
          const html = await res.text();
          videoStreamUrl =
            parseEmbeddedJSON(html) ||
            parseDOMMetaTags(html) ||
            parseScriptState(html);
        }
      } catch {
        // Fallback below
      }
    }

    // Tier 3.5: Dynamic Browser Interceptor (when initial HTTP HTML shell omits static video stream URL)
    if (!videoStreamUrl) {
      try {
        console.log(`[Unclip] Static HTTP HTML payload omitted video URL. Invoking Playwright browser media interceptor...`);
        return await defaultBrowserMediaRetriever.retrieve(canonicalUrl, authProvider);
      } catch (browserErr: unknown) {
        if ((browserErr as { code?: string }).code) throw browserErr;
      }
    }

    // Tier 4: Structured Failure Classification
    if (!videoStreamUrl) {
      throw createStructuredError(
        "Reel page was accessed, but no downloadable video stream URL was exposed by Instagram.",
        "MEDIA_URL_NOT_EXPOSED"
      );
    }

    // Temporary Video File Download & Verification for direct HTTP streams
    let tempFilePath: string | null = null;
    try {
      const mediaRes = await fetch(videoStreamUrl, {
        headers: authContext.headers,
      });

      if (!mediaRes.ok) {
        throw createStructuredError(
          `Failed to download video bytes from CDN (HTTP ${mediaRes.status}).`,
          "MEDIA_DOWNLOAD_FAILED"
        );
      }

      const contentType = mediaRes.headers.get("content-type") || "";
      if (
        contentType.includes("text/html") ||
        contentType.includes("application/json")
      ) {
        throw createStructuredError(
          "CDN returned a non-video media response (HTML/JSON).",
          "MEDIA_DOWNLOAD_FAILED"
        );
      }

      const arrayBuffer = await mediaRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const MAX_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB max
      if (buffer.length > MAX_SIZE_BYTES) {
        throw createStructuredError(
          "Video file exceeds maximum allowed size (100MB).",
          "INVALID_MEDIA"
        );
      }

      if (buffer.length === 0) {
        throw createStructuredError(
          "Downloaded video media stream is empty (0 bytes).",
          "INVALID_MEDIA"
        );
      }

      const tmpDir = os.tmpdir();
      tempFilePath = path.join(tmpDir, `unclip_video_${generateId()}.mp4`);
      await fs.writeFile(tempFilePath, buffer);

      const stat = await fs.stat(tempFilePath);
      if (stat.size === 0) {
        throw createStructuredError(
          "Saved video file on disk is 0 bytes.",
          "INVALID_MEDIA"
        );
      }

      return {
        kind: "video",
        contentType: contentType || "video/mp4",
        size: stat.size,
        localPath: tempFilePath,
      };
    } catch (err) {
      if (tempFilePath) {
        fs.unlink(tempFilePath).catch(() => {});
      }
      if ((err as { code?: string }).code) throw err;
      throw createStructuredError(
        "Failed to download video bytes: " + (err instanceof Error ? err.message : String(err)),
        "MEDIA_DOWNLOAD_FAILED"
      );
    }
  }
}

export const defaultMediaRetriever: MediaRetriever = new PublicInstagramMediaRetriever();
