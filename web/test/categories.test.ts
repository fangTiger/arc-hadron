import { describe, expect, test } from "vitest";
import {
  CATEGORY_TAB_OPTIONS,
  categoryDisplay,
  displayCategoryForChainCategory,
} from "../lib/categories";

describe("market display categories", () => {
  test("builds ALL plus fourteen display category tab options", () => {
    expect(CATEGORY_TAB_OPTIONS.map((option) => option.label)).toEqual([
      "ALL",
      "TREASURIES",
      "SOVEREIGN BONDS",
      "CORPORATE BONDS",
      "MONEY MARKET FUNDS",
      "PRIVATE CREDIT",
      "MORTGAGES",
      "REAL ESTATE",
      "EQUIPMENT FINANCE",
      "COMMODITIES",
      "CARBON",
      "INFRASTRUCTURE",
      "MUSIC ROYALTIES",
      "ART & COLLECTIBLES",
      "INVOICE FINANCING",
    ]);
  });

  test("maps gold and commodities chain categories into the COMMODITIES display category", () => {
    expect(displayCategoryForChainCategory("gold")).toBe("commodities");
    expect(displayCategoryForChainCategory("commodities")).toBe("commodities");
    expect(categoryDisplay("gold").label).toBe("COMMODITIES");
  });

  test("provides a ticker badge color for every display category", () => {
    for (const option of CATEGORY_TAB_OPTIONS.filter((item) => item.value !== "all")) {
      expect(categoryDisplay(option.value).tickerClassName).toContain("border-");
    }
  });
});
