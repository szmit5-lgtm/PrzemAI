"use strict";
// Seller-level onboarding: no account credentials, scraping or publishing.
function prepareSellerOnboarding(input = {}) {
  const sellerUrl = parseSellerUrl(input.sellerUrl);
  const channels = input.channels ?? ["OLX", "FACEBOOK_MARKETPLACE"];
  if (!Array.isArray(channels) || !channels.length ||
      channels.some(c => !["OLX", "FACEBOOK_MARKETPLACE"].includes(c))) {
    throw new TypeError("unsupported channel");
  }
  return Object.freeze({
    sellerUrl,
    sellerName: decodeURIComponent(new URL(sellerUrl).pathname.split("/")[2]),
    source: "ALLEGRO_SELLER",
    channels: Object.freeze([...new Set(channels)]),
    catalogSync: "REQUIRES_AUTHORIZED_ALLEGRO_CONNECTION",
    contentReuse: "REQUIRES_RIGHTS_CONFIRMATION",
    publication: "REQUIRES_CHANNEL_CONNECTION_AND_APPROVAL",
    status: "AWAITING_CONNECTION",
    published: false
  });
}
function parseSellerUrl(input) {
  if (typeof input !== "string" || input.length > 2048) throw new TypeError("invalid seller URL");
  let url;
  try { url = new URL(input); } catch { throw new TypeError("invalid seller URL"); }
  if (url.protocol !== "https:" || !["allegro.pl", "www.allegro.pl"].includes(url.hostname.toLowerCase()) ||
      url.port || url.username || url.password || !/^\/uzytkownik\/[a-zA-Z0-9_-]{3,80}\/?$/.test(url.pathname)) {
    throw new TypeError("invalid seller URL");
  }
  return "https://allegro.pl" + url.pathname.replace(/\/$/, "");
}
module.exports = { prepareSellerOnboarding, parseSellerUrl };
