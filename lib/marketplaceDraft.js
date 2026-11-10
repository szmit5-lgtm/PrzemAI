"use strict";

// Draft-only listing intake. No scraping, publishing, logins or external requests.
// Source text/images must be provided or fetched later through authorized integrations.
function prepareMarketplaceDraft(input = {}) {
  const url = parseAllegroUrl(input.url);
  const title = requiredText(input.title, 5, 140, "title");
  const description = requiredText(input.description, 10, 10000, "description");
  const priceGrosz = input.priceGrosz;
  if (!Number.isSafeInteger(priceGrosz) || priceGrosz <= 0) throw new TypeError("invalid priceGrosz");
  const photos = input.photos ?? [];
  if (!Array.isArray(photos) || photos.length > 20 ||
      photos.some(photo => typeof photo !== "string" || !/^https:\/\//i.test(photo) || photo.length > 2048)) {
    throw new TypeError("invalid photo URLs");
  }
  const allowedChannels = ["OLX", "FACEBOOK_MARKETPLACE"];
  const channels = input.channels ?? allowedChannels;
  if (!Array.isArray(channels) || channels.length < 1 || channels.some(x => !allowedChannels.includes(x))) {
    throw new TypeError("unsupported channel");
  }
  if (input.rightsConfirmed !== true) throw new Error("Seller rights to reuse listing content must be confirmed");
  return Object.freeze({
    source: "ALLEGRO", sourceUrl: url, title, description, priceGrosz,
    photos: Object.freeze([...photos]), channels: Object.freeze([...new Set(channels)]),
    status: "DRAFT_REVIEW_REQUIRED", published: false
  });
}
function parseAllegroUrl(value) {
  if (typeof value !== "string" || value.length > 2048) throw new TypeError("invalid Allegro URL");
  let url;
  try { url = new URL(value); } catch { throw new TypeError("invalid Allegro URL"); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.username || url.password || url.port ||
      !["allegro.pl", "www.allegro.pl"].includes(host)) throw new TypeError("invalid Allegro URL");
  return url.toString();
}
function requiredText(value, min, max, name) {
  if (typeof value !== "string" || value.trim().length < min || value.trim().length > max) {
    throw new TypeError("invalid " + name);
  }
  return value.trim();
}
module.exports = { prepareMarketplaceDraft, parseAllegroUrl };
