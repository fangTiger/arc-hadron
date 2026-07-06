import { describe, expect, test } from "vitest";
import { isValidIntent, parseIntent } from "../lib/ai/intent";

describe("AI intent schema", () => {
  test("accepts every whitelisted intent shape", () => {
    const intents = [
      { kind: "query_price", asset: "HADRON" },
      { kind: "query_depth", asset: "tbill" },
      { kind: "query_holdings" },
      { kind: "query_holdings", asset: "HADRON" },
      { kind: "query_yield" },
      { kind: "buy", asset: "HADRON", quantity: 1.25 },
      { kind: "sell", asset: "HADRON", quantity: 1.25 },
      { kind: "sell", asset: "HADRON", quantity: 1.25, price: 2.1 },
      { kind: "cancel", asset: "HADRON" },
      { kind: "claim" },
      { kind: "claim", asset: "HADRON" },
      { kind: "unknown" },
    ] as const;

    for (const intent of intents) {
      expect(isValidIntent(intent)).toBe(true);
      expect(parseIntent(intent)).toEqual(intent);
    }
  });

  test("downgrades non-whitelisted and malformed outputs to unknown", () => {
    const malformedOutputs: unknown[] = [
      null,
      "buy 1 HADRON",
      {},
      { kind: "deposit", asset: "HADRON", quantity: 1 },
      { kind: "transfer", asset: "HADRON", quantity: 1 },
      { kind: "query_price" },
      { kind: "query_price", asset: "" },
      { kind: "query_price", asset: "HADRON", tokenId: "15" },
      { kind: "query_yield", asset: "HADRON" },
      { kind: "unknown", message: "I can help." },
    ];

    for (const output of malformedOutputs) {
      expect(isValidIntent(output)).toBe(false);
      expect(parseIntent(output)).toEqual({ kind: "unknown" });
    }
  });

  test("requires buy quantity to be positive with at most two decimals", () => {
    expect(parseIntent({ kind: "buy", asset: "HADRON", quantity: 0.01 })).toEqual({
      kind: "buy",
      asset: "HADRON",
      quantity: 0.01,
    });
    expect(parseIntent({ kind: "buy", asset: "HADRON", quantity: 10 })).toEqual({
      kind: "buy",
      asset: "HADRON",
      quantity: 10,
    });

    for (const quantity of [0, -1, 1.001, Number.NaN, Number.POSITIVE_INFINITY, "1"]) {
      expect(isValidIntent({ kind: "buy", asset: "HADRON", quantity })).toBe(false);
      expect(parseIntent({ kind: "buy", asset: "HADRON", quantity })).toEqual({
        kind: "unknown",
      });
    }
  });

  test("requires sell quantity and optional price to be positive with at most two decimals", () => {
    expect(parseIntent({ kind: "sell", asset: "HADRON", quantity: 0.01 })).toEqual({
      kind: "sell",
      asset: "HADRON",
      quantity: 0.01,
    });
    expect(parseIntent({ kind: "sell", asset: "HADRON", quantity: 10, price: 2.1 })).toEqual({
      kind: "sell",
      asset: "HADRON",
      quantity: 10,
      price: 2.1,
    });

    for (const quantity of [0, -1, 1.001, Number.NaN, Number.POSITIVE_INFINITY, "1"]) {
      expect(isValidIntent({ kind: "sell", asset: "HADRON", quantity })).toBe(false);
      expect(parseIntent({ kind: "sell", asset: "HADRON", quantity })).toEqual({
        kind: "unknown",
      });
    }

    for (const price of [0, -1, 1.001, Number.NaN, Number.POSITIVE_INFINITY, "1"]) {
      expect(isValidIntent({ kind: "sell", asset: "HADRON", quantity: 1, price })).toBe(false);
      expect(parseIntent({ kind: "sell", asset: "HADRON", quantity: 1, price })).toEqual({
        kind: "unknown",
      });
    }
  });

  test("rejects transaction parameters and numeric chain identifiers from LLM output", () => {
    const unsafeOutputs: unknown[] = [
      { kind: "buy", asset: "HADRON", quantity: 1, pricePerShare: "1.25" },
      { kind: "buy", asset: "HADRON", quantity: 1, listingId: "7" },
      { kind: "buy", asset: "HADRON", quantity: 1, value: "1250000000000000000" },
      { kind: "sell", asset: "HADRON", quantity: 1, tokenId: "15" },
      { kind: "sell", asset: "HADRON", quantity: 1, listingId: "7" },
      { kind: "cancel", asset: "HADRON", listingId: "7" },
      { kind: "cancel", asset: "HADRON", bidId: "2" },
      { kind: "claim", asset: "HADRON", tokenId: "15" },
      { kind: "query_depth", asset: "HADRON", tokenId: "15" },
    ];

    for (const output of unsafeOutputs) {
      expect(parseIntent(output)).toEqual({ kind: "unknown" });
    }
  });
});
