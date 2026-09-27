import { validateInstagramUrl } from "./validator";
import { RetrievedMetadata } from "@/types";

export async function fetchInstagramMetadata(rawUrl: string): Promise<RetrievedMetadata> {
  const validation = validateInstagramUrl(rawUrl);
  if (!validation.isValid || !validation.canonicalUrl) {
    throw new Error(validation.error || "Invalid Instagram URL format.");
  }

  const canonicalUrl = validation.canonicalUrl;
  const mediaId = validation.mediaId;

  // Try fetching public oEmbed metadata if available
  try {
    const oembedUrl = `https://api.instagram.com/oembed/?url=${encodeURIComponent(canonicalUrl)}`;
    const response = await fetch(oembedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      next: { revalidate: 3600 },
    });

    if (response.ok) {
      const data = await response.json();
      return {
        url: rawUrl,
        canonicalUrl,
        mediaId,
        title: data.title || `Instagram Reel (${mediaId})`,
        author: data.author_name ? `@${data.author_name}` : "@instagram_creator",
        thumbnailUrl: data.thumbnail_url || undefined,
      };
    }
  } catch {
    // Fallback metadata if oEmbed request is blocked or throttled
  }

  return {
    url: rawUrl,
    canonicalUrl,
    mediaId,
    title: `Instagram Video (${mediaId})`,
    author: "@instagram_creator",
  };
}
