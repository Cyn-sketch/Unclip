import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import { chromium, Browser, BrowserContext } from "playwright";
import { RetrievedMedia, InstagramErrorCode } from "@/types";
import { validateInstagramUrl } from "./validator";
import { generateId } from "@/lib/utils";
import { InstagramAuthProvider, defaultInstagramAuthProvider } from "./auth";
import { createStructuredError } from "./media";
import { resolveFFmpegBinaryPath } from "@/lib/audio/extractor";

const execAsync = promisify(exec);

export interface InterceptedMediaInfo {
  url: string;
  status: number;
  contentType: string;
  contentLength: string;
  contentRange: string;
  resourceType: string;
  hostname: string;
  pathname: string;
}

export class BrowserInstagramMediaRetriever {
  async retrieve(
    url: string,
    authProvider: InstagramAuthProvider = defaultInstagramAuthProvider
  ): Promise<RetrievedMedia> {
    const validation = validateInstagramUrl(url);
    if (!validation.isValid || !validation.canonicalUrl) {
      throw createStructuredError(
        validation.error || "Invalid Instagram URL format.",
        "INVALID_INSTAGRAM_URL"
      );
    }

    const canonicalUrl = validation.canonicalUrl;
    console.log(`[Unclip] Browser retrieval started for: ${canonicalUrl}`);

    const authContext = await authProvider.getAuthenticatedContext();
    let browser: Browser | null = null;
    let context: BrowserContext | null = null;
    let tempVideoPath: string | null = null;

    try {
      // Launch headless Chromium browser
      browser = await chromium.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--disable-gpu",
        ],
      });
      console.log(`[Unclip] Playwright Chromium browser initialized (headless)`);

      context = await browser.newContext({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        viewport: { width: 1280, height: 720 },
      });

      // Attach dummy account session cookies if enabled
      if (authContext.isAuthEnabled) {
        const sessionId = process.env.INSTAGRAM_SESSIONID?.trim();
        const dsUserId = process.env.INSTAGRAM_DS_USER_ID?.trim();
        const csrfToken = process.env.INSTAGRAM_CSRFTOKEN?.trim();

        if (sessionId) {
          const cookies = [
            {
              name: "sessionid",
              value: sessionId,
              domain: ".instagram.com",
              path: "/",
              httpOnly: true,
              secure: true,
            },
          ];
          if (dsUserId) {
            cookies.push({
              name: "ds_user_id",
              value: dsUserId,
              domain: ".instagram.com",
              path: "/",
              httpOnly: false,
              secure: true,
            });
          }
          if (csrfToken) {
            cookies.push({
              name: "csrftoken",
              value: csrfToken,
              domain: ".instagram.com",
              path: "/",
              httpOnly: false,
              secure: true,
            });
          }

          await context.addCookies(cookies);
          console.log(`[Unclip] Authenticated browser cookies attached: true`);
        }
      } else {
        console.log(`[Unclip] Authenticated browser cookies attached: false`);
      }

      const page = await context.newPage();

      const candidateMediaList: InterceptedMediaInfo[] = [];

      // Listen for dynamic network responses generated while Instagram renders the Reel
      page.on("response", async (response) => {
        try {
          const resUrl = response.url();
          const headers = response.headers();
          const contentType = headers["content-type"] || "";
          const contentLength = headers["content-length"] || "N/A";
          const contentRange = headers["content-range"] || "N/A";
          const status = response.status();
          const resourceType = response.request().resourceType();

          let hostname = "";
          let pathname = "";
          try {
            const parsed = new URL(resUrl);
            hostname = parsed.hostname;
            pathname = parsed.pathname;
          } catch {
            // ignore URL parse error
          }

          const isVideoUrl =
            pathname.endsWith(".mp4") ||
            pathname.includes("/bytestream/") ||
            contentType.includes("video/mp4") ||
            contentType.includes("video/x-m4v") ||
            (contentType.includes("video/") && !contentType.includes("text")) ||
            resourceType === "media";

          if (isVideoUrl) {
            // Safe logging without query parameters or signed URL tokens
            console.log(`[Unclip Diagnostics] candidate media response:`);
            console.log(`  status: ${status}`);
            console.log(`  contentType: ${contentType}`);
            console.log(`  contentLength: ${contentLength}`);
            console.log(`  contentRange: ${contentRange}`);
            console.log(`  resourceType: ${resourceType}`);
            console.log(`  hostname: ${hostname}`);
            console.log(`  pathname: ${pathname}`);

            candidateMediaList.push({
              url: resUrl,
              status,
              contentType: contentType || "video/mp4",
              contentLength,
              contentRange,
              resourceType,
              hostname,
              pathname,
            });
          }
        } catch {
          // Ignore response diagnostics logging errors for unrelated assets
        }
      });

      // Navigate to canonical Reel URL
      console.log(`[Unclip] Navigating browser to Reel page...`);
      const response = await page.goto(canonicalUrl, {
        waitUntil: "domcontentloaded",
        timeout: 25000,
      });

      if (response && response.status() === 404) {
        throw createStructuredError(
          "The requested Instagram Reel could not be found or has been deleted.",
          "REEL_UNAVAILABLE"
        );
      }

      // Check page text content for private account indicator
      const pageText = await page.content().catch(() => "");
      if (pageText.includes("This Account is Private") || pageText.includes("Private Account")) {
        throw createStructuredError(
          "This Instagram video belongs to a private account that is not accessible.",
          "PRIVATE_CONTENT_UNAVAILABLE"
        );
      }

      // Wait up to 6 seconds for video player initialization and network stream interception
      await page.waitForTimeout(6000);

      // Extract full MP4 URLs embedded in page scripts / state
      const extractedUrls = await page.evaluate(() => {
        const urls: string[] = [];
        const html = document.documentElement.innerHTML;

        const matches = html.matchAll(/"video_url"\s*:\s*"([^"]+)"/gi);
        for (const m of matches) {
          if (m[1]) urls.push(m[1].replace(/\\u0026/g, "&").replace(/\\/g, ""));
        }

        const versionMatches = html.matchAll(/"url"\s*:\s*"(https?:\\?\/\\?[^"]+\.mp4[^"]*)"/gi);
        for (const m of versionMatches) {
          if (m[1]) urls.push(m[1].replace(/\\u0026/g, "&").replace(/\\/g, ""));
        }

        const v = document.querySelector("video");
        if (v && v.src && v.src.startsWith("http")) {
          urls.push(v.src);
        }

        return Array.from(new Set(urls));
      }).catch(() => [] as string[]);

      console.log(`[Unclip] Embedded MP4 URLs found in page HTML state: ${extractedUrls.length}`);

      // Combine candidate URLs to try for full MP4 download
      const targetUrlsToTry: string[] = [...extractedUrls];
      candidateMediaList.forEach((c) => {
        if (!targetUrlsToTry.includes(c.url)) {
          targetUrlsToTry.push(c.url);
        }
      });

      let validVideoBuffer: Buffer | null = null;
      let selectedContentType = "video/mp4";

      // Attempt full unsegmented MP4 download via browser authenticated page.request
      for (const targetUrl of targetUrlsToTry) {
        try {
          console.log(`[Unclip] Requesting complete video resource via browser page.request...`);
          const fetchRes = await page.request.get(targetUrl);
          if (fetchRes.ok()) {
            const buf = await fetchRes.body();
            if (buf.length > 50000) {
              // Verify MP4 header signature (ftyp atom in first 64 bytes)
              const headerSlice = buf.subarray(0, 64);
              const hasFtyp = headerSlice.includes(Buffer.from("ftyp")) || headerSlice.includes(Buffer.from("moov"));
              if (hasFtyp) {
                validVideoBuffer = buf;
                selectedContentType = fetchRes.headers()["content-type"] || "video/mp4";
                console.log(`[Unclip] Successfully fetched complete MP4 buffer: size=${buf.length} bytes`);
                break;
              } else {
                console.log(`[Unclip Warning] Candidate response lacked valid MP4 header ('ftyp'/'moov' absent).`);
              }
            }
          }
        } catch (err) {
          console.log(`[Unclip Warning] Failed fetching candidate URL via page.request: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      if (!validVideoBuffer) {
        throw createStructuredError(
          "Reel page accessed in browser, but no valid complete video file could be resolved.",
          "MEDIA_URL_NOT_EXPOSED"
        );
      }

      // Save video buffer to temporary file on server disk
      const tmpDir = os.tmpdir();
      tempVideoPath = path.join(tmpDir, `unclip_browser_video_${generateId()}.mp4`);
      await fs.writeFile(tempVideoPath, validVideoBuffer);

      const stat = await fs.stat(tempVideoPath);
      console.log(`[Unclip Pre-Validation] Temporary video file written: size=${stat.size} bytes`);

      // Container probe validation using FFmpeg binary
      const ffmpegBin = resolveFFmpegBinaryPath();
      try {
        await execAsync(`"${ffmpegBin}" -v error -i "${tempVideoPath}" -f null -`, { timeout: 10000 });
        console.log(`[Unclip Pre-Validation] FFmpeg container check passed successfully! Valid MP4 container.`);
      } catch (validationErr) {
        console.log(`[Unclip Pre-Validation Warning] FFmpeg container check failed: ${validationErr instanceof Error ? validationErr.message : String(validationErr)}`);
      }

      return {
        kind: "video",
        contentType: selectedContentType,
        size: stat.size,
        localPath: tempVideoPath,
      };
    } catch (err) {
      if (tempVideoPath) {
        fs.unlink(tempVideoPath).catch(() => {});
      }
      if ((err as { code?: string }).code) throw err;

      const browserErr = new Error(
        "Browser media retrieval failed: " + (err instanceof Error ? err.message : String(err))
      );
      (browserErr as Error & { code: InstagramErrorCode }).code = "MEDIA_RETRIEVAL_UNAVAILABLE";
      throw browserErr;
    } finally {
      if (context) await context.close().catch(() => {});
      if (browser) await browser.close().catch(() => {});
    }
  }
}

export const defaultBrowserMediaRetriever = new BrowserInstagramMediaRetriever();
