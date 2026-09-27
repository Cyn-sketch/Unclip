import { URL } from "url";

const ALLOWED_HOSTS = [
  "instagram.com",
  "www.instagram.com",
  "instagr.am",
  "www.instagr.am",
  "m.instagram.com",
  "api.instagram.com",
];

const BLOCKED_IP_PREFIXES = [
  "127.",
  "10.",
  "192.168.",
  "169.254.",
  "0.0.0.0",
  "localhost",
  "::1",
];

export function validateSafeExternalUrl(inputUrl: string): { isSafe: boolean; reason?: string } {
  try {
    const parsed = new URL(inputUrl);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { isSafe: false, reason: "Only HTTP and HTTPS protocols are allowed." };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Prevent access to internal hosts/IPs
    if (BLOCKED_IP_PREFIXES.some((prefix) => hostname === prefix || hostname.startsWith(prefix))) {
      return { isSafe: false, reason: "Access to private or loopback IP addresses is forbidden." };
    }

    // Host whitelist for Instagram media operations
    const isAllowedHost = ALLOWED_HOSTS.some(
      (host) => hostname === host || hostname.endsWith(`.${host}`)
    );

    if (!isAllowedHost) {
      return { isSafe: false, reason: "URL domain is not a supported Instagram media host." };
    }

    return { isSafe: true };
  } catch {
    return { isSafe: false, reason: "Malformed URL format." };
  }
}
