// lib/constants.js
// Valores del libro — NO hardcodear en componentes

export const BOOK_TITLE = "IRREDUCTIBLE. La Anomalía Persistente";
export const BOOK_AUTHOR = "Pablo Bravo";
export const BOOK_SKU = process.env.LULU_BOOK_SKU || "";
export const BOOK_PAGE_COUNT = parseInt(process.env.BOOK_PAGE_COUNT || "0", 10);
export const FULFILLMENT_FEE_USD = 0.75;
export const BOOK_SELL_PRICE_USD = 21.50;

// Mapeo de shipping_option ID → Lulu shipping_level
// Los IDs vienen del checkout.html (SHIPPING_MOCK) y se mapean al formato Lulu
export const SHIPPING_LEVEL_MAP = {
  us_mail: "MAIL",
  us_priority: "PRIORITY_MAIL",
  us_express: "EXPRESS",
  ca_mail: "MAIL",
  ca_priority: "PRIORITY_MAIL",
  gb_mail: "MAIL",
  gb_express: "EXPRESS",
  de_mail: "MAIL",
  de_express: "EXPRESS",
  fr_mail: "MAIL",
  fr_express: "EXPRESS",
  au_mail: "MAIL",
  au_express: "EXPRESS",
  jp_mail: "MAIL",
  jp_express: "EXPRESS",
};
SHIPPING_LEVEL_MAP._default = "MAIL";
