import { describe, expect, test } from "vitest";
import {
  SHARE_SCALE,
  sharePriceInputToUnitPrice,
  sharesFromUnits,
  unitPriceToSharePrice,
  unitsFromSharesInput,
} from "../lib/shares";

const USDC = 10n ** 18n;

describe("share unit conversion", () => {
  test("keeps the chain/display share scale explicit", () => {
    expect(SHARE_SCALE).toBe(100n);
  });

  test("converts chain units into display share numbers", () => {
    expect(sharesFromUnits(1n)).toBe(0.01);
    expect(sharesFromUnits(150n)).toBe(1.5);
    expect(sharesFromUnits(12_345n)).toBe(123.45);
  });

  test("round-trips display share input to chain units", () => {
    expect(unitsFromSharesInput("0.01")).toBe(1n);
    expect(unitsFromSharesInput("1")).toBe(100n);
    expect(unitsFromSharesInput("1.5")).toBe(150n);
    expect(unitsFromSharesInput("123.45")).toBe(12_345n);
  });

  test("rejects illegal share inputs, three decimal places, and zero shares", () => {
    for (const input of ["", "  ", "abc", "-1", "1.2.3", "1,000", "1.001", "0", "0.00"]) {
      expect(() => unitsFromSharesInput(input)).toThrow("Enter a valid amount");
    }
  });
});

describe("share price conversion", () => {
  test("converts chain unit price into display share price", () => {
    expect(unitPriceToSharePrice(USDC / 100n)).toBe(USDC);
    expect(unitPriceToSharePrice(12500000000000000n)).toBe(1250000000000000000n);
  });

  test("converts display share price input into exact chain unit price", () => {
    expect(sharePriceInputToUnitPrice("1")).toBe(USDC / 100n);
    expect(sharePriceInputToUnitPrice("1.25")).toBe(12500000000000000n);
    expect(sharePriceInputToUnitPrice("0.01")).toBe(100000000000000n);
  });

  test("rejects display prices that cannot divide into unit precision", () => {
    expect(() => sharePriceInputToUnitPrice("0.000000000000000001")).toThrow(
      "Enter a valid price",
    );
  });
});
