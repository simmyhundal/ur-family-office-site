// Visible words on a page, excluding header and footer (issue 239: "say each thing once per page").
// Counts the text inside <main> as a first-time visitor sees it before clicking anything: script, style, svg, <select>
// options, .sr-only text, elements marked `hidden` and the bodies of closed <details> (their <summary> counts) are left out.
// Text the page's scripts fill in later is not counted here; tests add it where it matters (Pricing's plan cards).
//   node tests/site/wordcount.mjs site/index.html site/try/index.html ...
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " ", rarr: "→", middot: "·" };

export function visibleText(html) {
  const m = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/);
  let s = m ? m[1] : html;
  s = s.replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|svg|select|datalist|canvas)\b[\s\S]*?<\/\1>/g, " ")
    .replace(/<details\b(?![^>]*\bopen\b)[^>]*>\s*(<summary\b[\s\S]*?<\/summary>)[\s\S]*?<\/details>/g, " $1 ");
  // Hidden elements and screen-reader-only text: innermost first, repeated, so nesting of other tags does not matter.
  const hiddenRe = /<(\w+)\b[^>]*(\shidden(?=[\s>=])|class="[^"]*\bsr-only\b[^"]*")[^>]*>(?:(?!<\1\b)[\s\S])*?<\/\1>/g;
  for (let prev = ""; prev !== s;) { prev = s; s = s.replace(hiddenRe, " "); }
  return s.replace(/<[^>]+>/g, " ").replace(/&(#?\w+);/g, (x, e) => ENT[e] ?? " ").replace(/\s+/g, " ").trim();
}

export const countWords = (text) => (text.match(/\S+/g) || []).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
export const visibleWords = (html) => countWords(visibleText(html));

if (import.meta.url === `file://${process.argv[1]}`) {
  const { readFile } = await import("node:fs/promises");
  for (const f of process.argv.slice(2)) console.log(String(visibleWords(await readFile(f, "utf8"))).padStart(5), f);
}
