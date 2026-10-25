import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "מנדטים",
    short_name: "מנדטים",
    description: "ניחוש מושבים לכנסת. קבוצה משלכם, דירוג ארצי, בלי לחשוף את הניחוש.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    lang: "he",
    dir: "rtl",
    background_color: "#f6f1e7",
    theme_color: "#0f5c56",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
