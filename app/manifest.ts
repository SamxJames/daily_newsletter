import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Daily Brief",
    short_name: "Daily Brief",
    description: "A personal daily briefing",
    start_url: "/",
    display: "standalone",
    background_color: "#0d1317",
    theme_color: "#0b6b60",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
