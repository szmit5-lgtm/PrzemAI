// server.url is an opt-in Capacitor staging mode. The default project can
// be synced without accessing an environment or packaging a remote URL.
function createConfig(stagingOrigin) {
  const config = {
    appId: "com.dekonica.przemai",
    appName: "PrzemAI",
    webDir: "www"
  };
  if (!stagingOrigin) return config;

  const url = new URL(stagingOrigin);
  if (url.protocol !== "https:" || url.username || url.password ||
      url.search || url.hash || url.pathname !== "/") {
    throw new Error("PRZEMAI_MOBILE_STAGING_ORIGIN musi być adresem HTTPS bez ścieżki i danych logowania.");
  }
  return { ...config, server: { url: url.origin, cleartext: false, errorPath: "index.html" } };
}

module.exports = createConfig(process.env.PRZEMAI_MOBILE_STAGING_ORIGIN);
Object.defineProperty(module.exports, "createConfig", { value: createConfig });
