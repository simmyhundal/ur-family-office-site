import { el } from "./util.mjs";

// Plain-language context for the bundled universe. Prices and labels remain the data source.
const FUND_GROUPS = [
  [["SPY", "VOO", "IVV"], "Fund · Tracks the S&P 500: large US companies."],
  [["VTI", "DEMOUS"], "Fund · A broad basket of US company stocks."],
  [["QQQ"], "Fund · Tracks the Nasdaq-100: large non-financial Nasdaq-listed companies."],
  [["DIA"], "Fund · Tracks the 30 companies in the Dow Jones Industrial Average."],
  [["IWM", "IJR", "VB"], "Fund · Stocks of smaller US companies."],
  [["IJH", "SCHM", "VO"], "Fund · Stocks of medium-sized US companies."],
  [["VUG"], "Fund · US stocks selected for growth characteristics."],
  [["VTV"], "Fund · US stocks selected for value characteristics."],
  [["VIG"], "Fund · US companies with a history of growing dividends."],
  [["SCHD", "VYM"], "Fund · Dividend-paying US company stocks."],
  [["QUAL"], "Fund · Stocks selected for measures of company quality."],
  [["USMV"], "Fund · US stocks selected for lower price volatility."],
  [["VEA", "IEFA", "EFA"], "Fund · Company stocks in developed markets outside the US."],
  [["VWO", "IEMG"], "Fund · Company stocks in emerging markets."],
  [["VXUS"], "Fund · A broad basket of company stocks outside the US."],
  [["BND", "AGG", "DEMOBD"], "Fund · A broad basket of US investment-grade bonds."],
  [["BNDX"], "Fund · Bonds issued outside the US."],
  [["TLT"], "Fund · Long-term US government bonds."],
  [["IEF"], "Fund · Intermediate-term US government bonds."],
  [["SHY"], "Fund · Short-term US government bonds."],
  [["LQD"], "Fund · Investment-grade company bonds."],
  [["HYG"], "Fund · Lower-rated company bonds, with higher credit risk."],
  [["TIP"], "Fund · US government bonds linked to inflation."],
  [["MUB"], "Fund · Bonds issued by US states and local governments."],
  [["SGOV", "BIL"], "Fund · Very short-term US Treasury bills."],
  [["GLD", "DEMOGD"], "Fund · Exposure to the price of gold."],
  [["SLV"], "Fund · Exposure to the price of silver."],
  [["VNQ"], "Fund · US real estate companies and investment trusts."],
  [["XLK", "VGT"], "Fund · Technology-sector company stocks."],
  [["XLF"], "Fund · Financial-sector company stocks."],
  [["XLE"], "Fund · Energy-sector company stocks."],
  [["XLV"], "Fund · Health-care company stocks."],
  [["XLY"], "Fund · Companies selling discretionary consumer goods and services."],
  [["XLP"], "Fund · Companies selling everyday consumer necessities."],
  [["XLI"], "Fund · Industrial-sector company stocks."],
  [["XLU"], "Fund · Utility-company stocks."],
  [["XLB"], "Fund · Materials-sector company stocks."],
  [["SMH"], "Fund · Semiconductor-company stocks."],
  [["XBI"], "Fund · Biotechnology-company stocks."],
  [["JEPI"], "Fund · US stocks with an options-based income strategy."],
];
const FUND_DESCRIPTIONS = Object.fromEntries(FUND_GROUPS.flatMap(([symbols, description]) => symbols.map((s) => [s, description])));
const COMPANY_STOCKS = new Set(["AAPL", "MSFT", "AMZN", "GOOGL", "NVDA", "META", "TSLA", "BRK-B", "JPM", "V", "UNH", "COST", "KO", "JNJ"]);

export function investmentChoices(symbols, labels) {
  return symbols.map((symbol) => ({
    symbol,
    name: labels[symbol] || symbol,
    description: COMPANY_STOCKS.has(symbol)
      ? "Company stock · A stake in one company, rather than a basket of investments."
      : FUND_DESCRIPTIONS[symbol] || "Investment · No description available.",
  }));
}

export function findInvestments(choices, query) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return choices.filter((c) => words.every((w) => `${c.symbol} ${c.name} ${c.description}`.toLowerCase().includes(w)));
}

// Native disclosure and ordinary buttons work with touch, keyboard and screen readers.
// The description stays visible when the list is closed; no hover interaction is required.
export function createFundPicker({ id, label, symbol, choices, onChange }) {
  const picker = el("details", { class: "fund-picker", id });
  const summary = el("summary", { "aria-describedby": `${id}-description` });
  const description = el("p", { class: "fund-description", id: `${id}-description` });
  const search = el("input", { type: "search", placeholder: "Ticker or name", "aria-label": `Search ${label.toLowerCase()} by ticker or name`, autocomplete: "off" });
  const results = el("div", { class: "fund-results" });
  const status = el("p", { class: "muted small", role: "status" });
  const body = el("div", { class: "fund-picker-body" }, search, status, results);
  const setValue = (value) => {
    const choice = choices.find((c) => c.symbol === value);
    summary.textContent = choice ? `${choice.symbol} — ${choice.name}` : value;
    summary.setAttribute("aria-label", `${label}: ${summary.textContent}`);
    description.textContent = choice?.description || "No description available.";
  };
  const filter = () => {
    const matches = findInvestments(choices, search.value);
    status.textContent = matches.length ? `${matches.length} available` : "No matches. Try a ticker or name.";
    results.replaceChildren(...matches.map((choice) => {
      const button = el("button", { type: "button", class: "secondary fund-option" },
        el("b", {}, `${choice.symbol} — ${choice.name}`), el("span", {}, choice.description));
      button.addEventListener("click", () => {
        setValue(choice.symbol); picker.open = false;
        onChange(choice.symbol); summary.focus();
      });
      return button;
    }));
  };
  search.addEventListener("input", filter);
  picker.addEventListener("toggle", () => { if (picker.open) { search.value = ""; filter(); search.focus(); } });
  picker.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); picker.open = false; summary.focus(); }
    if (e.key === "ArrowDown" && e.target === search) { e.preventDefault(); results.querySelector("button")?.focus(); }
  });
  picker.append(summary, body);
  setValue(symbol);
  return { element: el("div", { class: "fund-field" }, picker, description), focus: () => { picker.open = true; search.focus(); }, setValue };
}
