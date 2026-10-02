import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Quick Cobro",
    short_name: "Cobro",
    description: "Cobro en mostrador",
    start_url: "/pos",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#F4F6F3",
    theme_color: "#7EB341",
    lang: "es",
    icons: [
      { src: "/pos-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pos-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pos-icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
