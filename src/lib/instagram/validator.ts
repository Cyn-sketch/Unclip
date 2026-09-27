export interface InstagramValidationResult {
  isValid: boolean;
  mediaId?: string;
  canonicalUrl?: string;
  error?: string;
}

const SUPPORTED_HOSTS = [
  "instagram.com",
  "www.instagram.com",
  "instagr.am",
  "www.instagr.am",
  "m.instagram.com",
];

export function validateInstagramUrl(rawUrl: string): InstagramValidationResult {
  if (!rawUrl || typeof rawUrl !== "string") {
    return {
      isValid: false,
      error: "Please enter a valid Instagram URL.",
    };
  }

  const trimmed = rawUrl.trim();
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    return {
      isValid: false,
      error: "URL must start with http:// or https://",
    };
  }

  try {
    const parsed = new URL(trimmed);
    const hostname = parsed.hostname.toLowerCase();

    if (!SUPPORTED_HOSTS.includes(hostname)) {
      return {
        isValid: false,
        error: "Only public Instagram URLs are supported (instagram.com).",
      };
    }

    // Match path pattern: /reel/CODE/, /p/CODE/, /reels/CODE/, /tv/CODE/, /share/p/CODE/
    const pathParts = parsed.pathname.split("/").filter(Boolean);
    if (pathParts.length === 0) {
      return {
        isValid: false,
        error: "Instagram URL must point to a specific Reel or Video post.",
      };
    }

    // Check path type
    const mediaTypeIndex = pathParts.findIndex((part) =>
      ["reel", "reels", "p", "tv", "share"].includes(part.toLowerCase())
    );

    if (mediaTypeIndex === -1) {
      return {
        isValid: false,
        error: "Unclip supports Instagram Reels and Video posts (/reel/ or /p/).",
      };
    }

    let mediaId = "";
    if (pathParts[mediaTypeIndex].toLowerCase() === "share" && pathParts[mediaTypeIndex + 1]) {
      mediaId = pathParts[mediaTypeIndex + 2] || pathParts[mediaTypeIndex + 1];
    } else {
      mediaId = pathParts[mediaTypeIndex + 1];
    }

    if (!mediaId) {
      return {
        isValid: false,
        error: "Could not extract media ID from the Instagram URL.",
      };
    }

    // Clean mediaId (remove query parameters or trailing slashes)
    mediaId = mediaId.split("?")[0].split("#")[0];

    const canonicalUrl = `https://www.instagram.com/reel/${mediaId}/`;

    return {
      isValid: true,
      mediaId,
      canonicalUrl,
    };
  } catch {
    return {
      isValid: false,
      error: "Invalid URL syntax.",
    };
  }
}
