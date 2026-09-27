export const SITE_CONFIG = {
  name: "Unclip",
  tagline: "Unclip any video.",
  description: "Turn publicly accessible Instagram videos into accurate, usable transcripts in seconds.",
  url: "https://unclip.app",
  ogImage: "https://unclip.app/og.png",
  nav: [
    { label: "Features", href: "#features" },
    { label: "Sample Reels", href: "#samples" },
    { label: "Docs", href: "#docs" },
  ],
  links: {
    github: "https://github.com/unclip/unclip",
  },
  theme: {
    darkBg: "#070709",
    cardBg: "#0f0f15",
    accentPurple: "#8b5cf6",
    accentPurpleGlow: "rgba(139, 92, 246, 0.15)",
  },
  supportedPlatforms: ["Instagram Reels", "Instagram Feed Videos"],
  maxDurationSeconds: 600, // 10 minutes limit
};
