import type { MetadataRoute } from "next";
import { APP_DESCRIPTION, APP_HOME, APP_NAME } from "@/lib/brand";

/** Makes the site installable ("Add to Home Screen"), required for push on iPhone. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: "Competiții",
    description: APP_DESCRIPTION,
    start_url: APP_HOME,
    scope: "/",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#ea580c",
    lang: "ro",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
