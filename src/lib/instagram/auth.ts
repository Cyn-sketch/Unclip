export type InstagramSessionStatus =
  | "unconfigured"
  | "authenticated"
  | "auth_expired"
  | "checkpoint_required"
  | "rate_limited"
  | "unknown";

export interface InstagramRequestContext {
  headers: Record<string, string>;
  isAuthEnabled: boolean;
  status: InstagramSessionStatus;
}

export interface InstagramAuthProvider {
  getAuthenticatedContext(): Promise<InstagramRequestContext>;
  validateSession(): Promise<InstagramSessionStatus>;
}

export class DefaultInstagramAuthProvider implements InstagramAuthProvider {
  private lastKnownStatus: InstagramSessionStatus = "unknown";
  private lastValidatedAt: number = 0;
  private readonly VALIDATION_TTL_MS = 300000; // 5 minutes cache for session status check

  async getAuthenticatedContext(): Promise<InstagramRequestContext> {
    const isAuthEnabled = process.env.INSTAGRAM_AUTH_ENABLED === "true";
    const sessionId = process.env.INSTAGRAM_SESSIONID?.trim();
    const dsUserId = process.env.INSTAGRAM_DS_USER_ID?.trim();
    const csrfToken = process.env.INSTAGRAM_CSRFTOKEN?.trim();

    if (!isAuthEnabled || !sessionId) {
      return {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        isAuthEnabled: false,
        status: "unconfigured",
      };
    }

    // Build Cookie string without logging sensitive parameters
    const cookieParts: string[] = [`sessionid=${sessionId}`];
    if (dsUserId) cookieParts.push(`ds_user_id=${dsUserId}`);
    if (csrfToken) cookieParts.push(`csrftoken=${csrfToken}`);

    const headers: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      Cookie: cookieParts.join("; "),
      "X-IG-App-ID": "936619743392459",
      "X-Requested-With": "XMLHttpRequest",
    };

    if (csrfToken) {
      headers["X-CSRFToken"] = csrfToken;
    }

    const currentStatus = await this.validateSession();

    return {
      headers,
      isAuthEnabled: true,
      status: currentStatus,
    };
  }

  async validateSession(): Promise<InstagramSessionStatus> {
    const isAuthEnabled = process.env.INSTAGRAM_AUTH_ENABLED === "true";
    const sessionId = process.env.INSTAGRAM_SESSIONID?.trim();

    if (!isAuthEnabled || !sessionId) {
      this.lastKnownStatus = "unconfigured";
      return "unconfigured";
    }

    const now = Date.now();
    if (this.lastKnownStatus !== "unknown" && now - this.lastValidatedAt < this.VALIDATION_TTL_MS) {
      return this.lastKnownStatus;
    }

    try {
      const cookieParts = [`sessionid=${sessionId}`];
      if (process.env.INSTAGRAM_DS_USER_ID) {
        cookieParts.push(`ds_user_id=${process.env.INSTAGRAM_DS_USER_ID.trim()}`);
      }

      const res = await fetch("https://www.instagram.com/api/v1/users/web_profile_info/?username=instagram", {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Cookie: cookieParts.join("; "),
          "X-IG-App-ID": "936619743392459",
        },
      });

      if (res.status === 429) {
        this.lastKnownStatus = "rate_limited";
      } else if (res.status === 401 || res.status === 403) {
        this.lastKnownStatus = "auth_expired";
      } else if (res.url.includes("checkpoint") || res.url.includes("challenge")) {
        this.lastKnownStatus = "checkpoint_required";
      } else if (res.ok) {
        this.lastKnownStatus = "authenticated";
      } else {
        this.lastKnownStatus = "authenticated"; // Default graceful fallback
      }
    } catch {
      // If validation call fails network, preserve configured state
      this.lastKnownStatus = "authenticated";
    }

    this.lastValidatedAt = now;
    return this.lastKnownStatus;
  }
}

export const defaultInstagramAuthProvider: InstagramAuthProvider = new DefaultInstagramAuthProvider();
