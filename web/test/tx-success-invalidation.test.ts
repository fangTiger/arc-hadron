import { describe, expect, test } from "vitest";
import { shouldApplyTxSuccessInvalidation } from "../lib/hooks/useTxSuccessInvalidation";

const TX_HASH =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as const;

describe("transaction success invalidation", () => {
  test("runs once for a successful transaction hash", () => {
    expect(
      shouldApplyTxSuccessInvalidation({
        handledTxHash: undefined,
        status: "success",
        txHash: TX_HASH,
      }),
    ).toBe(true);
    expect(
      shouldApplyTxSuccessInvalidation({
        handledTxHash: TX_HASH,
        status: "success",
        txHash: TX_HASH,
      }),
    ).toBe(false);
  });

  test("ignores incomplete states and accepts a different successful hash", () => {
    expect(
      shouldApplyTxSuccessInvalidation({
        handledTxHash: undefined,
        status: "pending",
        txHash: TX_HASH,
      }),
    ).toBe(false);
    expect(
      shouldApplyTxSuccessInvalidation({
        handledTxHash: TX_HASH,
        status: "success",
        txHash:
          "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      }),
    ).toBe(true);
  });
});
