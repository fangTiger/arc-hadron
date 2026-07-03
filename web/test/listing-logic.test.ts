import { describe, expect, test } from "vitest";
import { validateListing, validateListingPurchase } from "../lib/listing";

const USDC = 10n ** 18n;

describe("validateListing", () => {
  test("returns chain units and unit price for a valid listing input", () => {
    expect(
      validateListing({
        amountInput: "3.25",
        balance: 1_000n,
        priceInput: "1.25",
      }),
    ).toEqual({
      ok: true,
      amount: 325n,
      pricePerShare: 12500000000000000n,
    });
  });

  test("rejects blank, over-precision, text, and negative quantities", () => {
    for (const amountInput of ["", "  ", "1.001", "abc", "-1"]) {
      expect(
        validateListing({
          amountInput,
          balance: 1_000n,
          priceInput: "1",
        }),
      ).toEqual({ ok: false, errorText: "Enter a valid amount" });
    }
  });

  test("rejects a zero listing quantity", () => {
    expect(
      validateListing({
        amountInput: "0",
        balance: 1_000n,
        priceInput: "1",
      }),
    ).toEqual({ ok: false, errorText: "Enter a valid amount" });
  });

  test("rejects an amount above the wallet balance", () => {
    expect(
      validateListing({
        amountInput: "11",
        balance: 1_000n,
        priceInput: "1",
      }),
    ).toEqual({ ok: false, errorText: "Exceeds your balance" });
  });

  test("rejects invalid listing prices", () => {
    for (const priceInput of [
      "",
      "  ",
      "abc",
      "-1",
      "1.0000000000000000001",
      "0.000000000000000001",
    ]) {
      expect(
        validateListing({
          amountInput: "1",
          balance: 1_000n,
          priceInput,
        }),
      ).toEqual({ ok: false, errorText: "Enter a valid price" });
    }
  });

  test("rejects a zero listing price", () => {
    expect(
      validateListing({
        amountInput: "1",
        balance: 1_000n,
        priceInput: "0",
      }),
    ).toEqual({ ok: false, errorText: "Enter a valid price" });
  });
});

describe("validateListingPurchase", () => {
  test("returns chain units and total value for a valid partial listing purchase", () => {
    expect(
      validateListingPurchase({
        amountInput: "2.5",
        balance: 100n * USDC,
        pricePerShare: 3n * USDC / 100n,
        remaining: 500n,
      }),
    ).toEqual({
      ok: true,
      amount: 250n,
      totalValue: 7500000000000000000n,
    });
  });

  test("rejects a partial purchase above the listing remainder", () => {
    expect(
      validateListingPurchase({
        amountInput: "6",
        balance: 100n * USDC,
        pricePerShare: 3n * USDC / 100n,
        remaining: 500n,
      }),
    ).toEqual({ ok: false, errorText: "Exceeds available supply" });
  });

  test("rejects an invalid listing purchase quantity", () => {
    expect(
      validateListingPurchase({
        amountInput: "0",
        balance: 100n * USDC,
        pricePerShare: 3n * USDC / 100n,
        remaining: 500n,
      }),
    ).toEqual({ ok: false, errorText: "Enter a valid amount" });
  });

  test("rejects a listing purchase when balance cannot cover total value and gas buffer", () => {
    expect(
      validateListingPurchase({
        amountInput: "1",
        balance: USDC,
        pricePerShare: USDC / 100n,
        remaining: 500n,
      }),
    ).toEqual({ ok: false, errorText: "Insufficient USDC balance" });
  });
});
