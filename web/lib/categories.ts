export interface CategoryDisplay {
  label: string;
  gradient: string;
  tickerClassName: string;
}

export type DisplayCategory =
  | "treasuries"
  | "sovereign-bonds"
  | "corporate-bonds"
  | "money-market-funds"
  | "private-credit"
  | "mortgages"
  | "real-estate"
  | "equipment-finance"
  | "commodities"
  | "carbon"
  | "infrastructure"
  | "music-royalties"
  | "art-collectibles"
  | "invoice-financing";

export type MarketCategory = "all" | DisplayCategory;

export const DISPLAY_CATEGORIES: { label: string; value: DisplayCategory }[] = [
  { label: "TREASURIES", value: "treasuries" },
  { label: "SOVEREIGN BONDS", value: "sovereign-bonds" },
  { label: "CORPORATE BONDS", value: "corporate-bonds" },
  { label: "MONEY MARKET FUNDS", value: "money-market-funds" },
  { label: "PRIVATE CREDIT", value: "private-credit" },
  { label: "MORTGAGES", value: "mortgages" },
  { label: "REAL ESTATE", value: "real-estate" },
  { label: "EQUIPMENT FINANCE", value: "equipment-finance" },
  { label: "COMMODITIES", value: "commodities" },
  { label: "CARBON", value: "carbon" },
  { label: "INFRASTRUCTURE", value: "infrastructure" },
  { label: "MUSIC ROYALTIES", value: "music-royalties" },
  { label: "ART & COLLECTIBLES", value: "art-collectibles" },
  { label: "INVOICE FINANCING", value: "invoice-financing" },
];

export const CATEGORY_TAB_OPTIONS: { label: string; value: MarketCategory }[] = [
  { label: "ALL", value: "all" },
  ...DISPLAY_CATEGORIES,
];

const categoryDisplays: Record<DisplayCategory, CategoryDisplay> = {
  treasuries: {
    label: "TREASURIES",
    gradient: "radial-gradient(circle at 20% 20%, #22d3ee 0%, #155e75 42%, #07111a 100%)",
    tickerClassName: "border-neon/50 bg-neon/10 text-neon",
  },
  "sovereign-bonds": {
    label: "SOVEREIGN BONDS",
    gradient: "radial-gradient(circle at 20% 20%, #60a5fa 0%, #1d4ed8 42%, #06111f 100%)",
    tickerClassName: "border-blue-300/50 bg-blue-400/10 text-blue-200",
  },
  "corporate-bonds": {
    label: "CORPORATE BONDS",
    gradient: "radial-gradient(circle at 20% 20%, #f59e0b 0%, #475569 46%, #0b1018 100%)",
    tickerClassName: "border-amber-300/45 bg-amber-300/10 text-amber-200",
  },
  "money-market-funds": {
    label: "MONEY MARKET FUNDS",
    gradient: "radial-gradient(circle at 20% 20%, #99f6e4 0%, #0f766e 44%, #061311 100%)",
    tickerClassName: "border-teal-200/45 bg-teal-200/10 text-teal-100",
  },
  "private-credit": {
    label: "PRIVATE CREDIT",
    gradient: "radial-gradient(circle at 20% 20%, #7dd3fc 0%, #24516a 44%, #07111a 100%)",
    tickerClassName: "border-sky-300/45 bg-sky-300/10 text-sky-200",
  },
  mortgages: {
    label: "MORTGAGES",
    gradient: "radial-gradient(circle at 20% 20%, #fda4af 0%, #7f1d1d 44%, #16070a 100%)",
    tickerClassName: "border-rose-200/45 bg-rose-200/10 text-rose-100",
  },
  "real-estate": {
    label: "REAL ESTATE",
    gradient: "radial-gradient(circle at 20% 20%, #4b647d 0%, #1d2733 46%, #080b10 100%)",
    tickerClassName: "border-slate-300/35 bg-slate-300/10 text-slate-200",
  },
  "equipment-finance": {
    label: "EQUIPMENT FINANCE",
    gradient: "radial-gradient(circle at 20% 20%, #fb923c 0%, #334155 46%, #0b1018 100%)",
    tickerClassName: "border-orange-200/45 bg-orange-200/10 text-orange-100",
  },
  commodities: {
    label: "COMMODITIES",
    gradient: "radial-gradient(circle at 20% 20%, #e9c46a 0%, #7c5c1e 44%, #11100b 100%)",
    tickerClassName: "border-gold/55 bg-gold/10 text-gold",
  },
  carbon: {
    label: "CARBON",
    gradient: "radial-gradient(circle at 20% 20%, #34d399 0%, #1e4d3a 44%, #07100c 100%)",
    tickerClassName: "border-up/45 bg-up/10 text-up",
  },
  infrastructure: {
    label: "INFRASTRUCTURE",
    gradient: "radial-gradient(circle at 20% 20%, #8bd3ff 0%, #23526b 43%, #07111a 100%)",
    tickerClassName: "border-cyan-200/45 bg-cyan-200/10 text-cyan-100",
  },
  "music-royalties": {
    label: "MUSIC ROYALTIES",
    gradient: "radial-gradient(circle at 20% 20%, #c084fc 0%, #7e22ce 44%, #11071a 100%)",
    tickerClassName: "border-violet-200/45 bg-violet-200/10 text-violet-100",
  },
  "art-collectibles": {
    label: "ART & COLLECTIBLES",
    gradient: "radial-gradient(circle at 20% 20%, #d8b4fe 0%, #4c2f5f 44%, #100918 100%)",
    tickerClassName: "border-fuchsia-200/35 bg-fuchsia-200/10 text-fuchsia-100",
  },
  "invoice-financing": {
    label: "INVOICE FINANCING",
    gradient: "radial-gradient(circle at 20% 20%, #facc15 0%, #5e4c12 44%, #11100b 100%)",
    tickerClassName: "border-amber-200/45 bg-amber-200/10 text-amber-100",
  },
};

export function displayCategoryForChainCategory(category: string): DisplayCategory {
  if (category === "gold" || category === "commodities") {
    return "commodities";
  }

  if (category in categoryDisplays) {
    return category as DisplayCategory;
  }

  return "real-estate";
}

export function categoryDisplay(category: string): CategoryDisplay {
  return categoryDisplays[displayCategoryForChainCategory(category)];
}
