// Renders the header and footer from data/site.json on every page, and sets the document title suffix.
import { loadSiteConfig, headerHtml, footerHtml, loadJson } from "./config.mjs";
import { upgradePlanLinks } from "./plans.mjs";

const root = new URL("../", import.meta.url).pathname;
const rel = location.pathname.startsWith(root) ? location.pathname.slice(root.length) : "";
export const currentKey = rel.split("/")[0] || "home";
export const cfg = await loadSiteConfig(new URL("../data/site.json", import.meta.url).href);
const prefix = new URL("../", import.meta.url).href;
const head = document.querySelector("header.site-head"), foot = document.querySelector("footer.site-foot");
if (head) head.innerHTML = headerHtml(cfg, prefix, currentKey);
if (foot) foot.innerHTML = footerHtml(cfg, prefix, currentKey);
document.title = document.title.replace(/UFO/g, cfg.name);

// Plus buttons written into the page (data-plus-cta): "Get Plus" once a checkout link is set, else "Get notified".
// "Have a code?" (data-promo) shows beside them only once a checkout link is set.
const plusLinks = document.querySelectorAll("[data-plus-cta]"), purchaseNotes = document.querySelectorAll("[data-purchase-note]"),
  promos = document.querySelectorAll("[data-promo]");
if (plusLinks.length) (async () => {
  try {
    const { plans } = await loadJson(new URL("../data/plans.json", import.meta.url).href);
    const plus = plans.find((p) => p.id === "plus");
    if (plus) upgradePlanLinks(plusLinks, plus, cfg.checkout_urls, prefix, purchaseNotes, cfg.show_code_box ? promos : []);  // codes off until issue 339 is decided
  } catch { /* keep the sign-up links */ }
})();
