"use strict";
// Test-mode order inquiry: prepares notification data, does NOT send email.
const TEST_INBOX = "biuro@misiowyswiat.pl";
function prepareCommerceInquiry(payload = {}) {
  const name = required(payload.customerName, 2, 120, "customerName");
  const email = required(payload.customerEmail, 3, 254, "customerEmail");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new TypeError("invalid email");
  const productUrl = parseOfferUrl(payload.productUrl);
  const quantity = payload.quantity ?? 1;
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100) throw new TypeError("invalid quantity");
  const note = payload.note === undefined ? "" : required(payload.note, 0, 1000, "note");
  const subject = "Misiowy_Swiat - zapytanie o produkt";
  const body = [
    "Nowe zapytanie testowe (nie jest to zamowienie Allegro).",
    "Klient: " + name, "Email: " + email,
    "Oferta: " + productUrl, "Ilosc: " + quantity,
    "Uwagi: " + note, "Status: wymaga recznego potwierdzenia"
  ].join("\n");
  return Object.freeze({ to: TEST_INBOX, subject, body, status: "EMAIL_NOT_SENT", orderStatus: "INQUIRY_ONLY", productUrl });
}
function parseOfferUrl(value) {
  if (typeof value !== "string" || value.length > 2048) throw new TypeError("invalid offer URL");
  let u;
  try { u = new URL(value); } catch { throw new TypeError("invalid offer URL"); }
  if (u.protocol !== "https:" || !["allegro.pl", "www.allegro.pl"].includes(u.hostname.toLowerCase()) ||
      u.username || u.password || u.port || !/^\/oferta\/[a-zA-Z0-9][a-zA-Z0-9-]*-[0-9]{6,20}\/?$/.test(u.pathname)) throw new TypeError("invalid offer URL");
  return "https://allegro.pl" + u.pathname;
}
function required(v, min, max, label) {
  if (typeof v !== "string" || v.trim().length < min || v.trim().length > max || /[\r\n]/.test(v)) {
    throw new TypeError("invalid " + label);
  }
  return v.trim();
}
module.exports = { prepareCommerceInquiry };
