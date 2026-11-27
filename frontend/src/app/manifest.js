export default function manifest() {
  return {
    id: "/",
    name: "PrzemAI",
    short_name: "PrzemAI",
    lang: "pl",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#070e22",
    theme_color: "#070e22",
    icons: [
      { src: "/mobile/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/mobile/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/mobile/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ]
  };
}
