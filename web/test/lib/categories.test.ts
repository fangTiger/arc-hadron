import { describe, expect, test } from "vitest";
import {
  DISPLAY_CATEGORIES,
  displayCategoryForChainCategory,
} from "../../lib/categories";

describe("batch-1 display category extensions", () => {
  test("maps sovereign and corporate bond chain categories directly", () => {
    expect(displayCategoryForChainCategory("sovereign-bonds")).toBe("sovereign-bonds");
    expect(displayCategoryForChainCategory("corporate-bonds")).toBe("corporate-bonds");
  });

  test("adds the two fixed-income categories to the display list", () => {
    expect(DISPLAY_CATEGORIES).toHaveLength(10);
    expect(DISPLAY_CATEGORIES.slice(0, 3)).toEqual([
      { label: "TREASURIES", value: "treasuries" },
      { label: "SOVEREIGN BONDS", value: "sovereign-bonds" },
      { label: "CORPORATE BONDS", value: "corporate-bonds" },
    ]);
  });
});
