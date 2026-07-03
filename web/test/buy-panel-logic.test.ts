import { describe, expect, test, vi } from "vitest";
import { refreshPurchaseReads } from "../components/asset/BuyPanel";
import { deriveBuyPrimaryState } from "../lib/hooks/useBuyPrimary";
import { GAS_BUFFER, mapWagmiError, validatePurchase } from "../lib/purchase";

const USDC = 10n ** 18n;

describe("validatePurchase", () => {
  test("returns chain units and total value for a valid display share amount", () => {
    const result = validatePurchase({
      amountInput: "1.5",
      remaining: 1_000n,
      balance: 100n * USDC,
      pricePerShare: 3n * USDC / 100n,
    });

    expect(result).toEqual({
      ok: true,
      amount: 150n,
      totalValue: 4500000000000000000n,
    });
  });

  test("accepts a balance that exactly covers total value and gas buffer", () => {
    const result = validatePurchase({
      amountInput: "1",
      remaining: 1_000n,
      balance: 2n * USDC + GAS_BUFFER,
      pricePerShare: 2n * USDC / 100n,
    });

    expect(result).toEqual({
      ok: true,
      amount: 100n,
      totalValue: 2n * USDC,
    });
  });

  test("returns a valid amount error for blank input", () => {
    expect(
      validatePurchase({
        amountInput: "   ",
        remaining: 1_000n,
        balance: 100n * USDC,
        pricePerShare: USDC / 100n,
      }),
    ).toEqual({ ok: false, errorText: "Enter a valid amount" });
  });

  test("returns a valid amount error for malformed display share input", () => {
    for (const amountInput of ["1.001", "abc", "-1"]) {
      expect(
        validatePurchase({
          amountInput,
          remaining: 1_000n,
          balance: 100n * USDC,
          pricePerShare: USDC / 100n,
        }),
      ).toEqual({ ok: false, errorText: "Enter a valid amount" });
    }
  });

  test("returns a valid amount error for zero input", () => {
    expect(
      validatePurchase({
        amountInput: "0",
        remaining: 1_000n,
        balance: 100n * USDC,
        pricePerShare: USDC / 100n,
      }),
    ).toEqual({ ok: false, errorText: "Enter a valid amount" });
  });

  test("returns an available supply error when amount exceeds remaining supply", () => {
    expect(
      validatePurchase({
        amountInput: "11",
        remaining: 1_000n,
        balance: 100n * USDC,
        pricePerShare: USDC / 100n,
      }),
    ).toEqual({ ok: false, errorText: "Exceeds available supply" });
  });

  test("returns an insufficient balance error when balance cannot cover total value and gas buffer", () => {
    expect(
      validatePurchase({
        amountInput: "1",
        remaining: 1_000n,
        balance: USDC + GAS_BUFFER - 1n,
        pricePerShare: USDC / 100n,
      }),
    ).toEqual({ ok: false, errorText: "Insufficient USDC balance" });
  });
});

describe("mapWagmiError", () => {
  test("maps user cancellation by error name", () => {
    expect(mapWagmiError({ name: "UserRejectedRequestError" })).toBe("Signature cancelled");
  });

  test("maps user cancellation when the name contains User rejected", () => {
    expect(mapWagmiError({ name: "User rejected by wallet" })).toBe("Signature cancelled");
  });

  test("maps user cancellation by error message", () => {
    expect(mapWagmiError(new Error("User rejected the request."))).toBe("Signature cancelled");
  });

  test("maps insufficient funds errors", () => {
    expect(mapWagmiError(new Error("insufficient funds for gas * price + value"))).toBe(
      "Insufficient funds for this transaction",
    );
  });

  test("maps unknown errors to a generic retry prompt", () => {
    expect(mapWagmiError(new Error("execution reverted"))).toBe("Transaction failed, please retry");
  });
});

describe("deriveBuyPrimaryState", () => {
  test("derives success when a pending transaction receives a success receipt", () => {
    expect(
      deriveBuyPrimaryState({
        localStatus: "pending",
        receiptStatus: "success",
      }),
    ).toEqual({ status: "success" });
  });

  test("derives an on-chain revert error when a pending transaction receives a reverted receipt", () => {
    expect(
      deriveBuyPrimaryState({
        localStatus: "pending",
        receiptStatus: "reverted",
      }),
    ).toEqual({ status: "error", errorText: "Transaction reverted on-chain" });
  });

  test("reuses wagmi error mapping for pending receipt query errors", () => {
    expect(
      deriveBuyPrimaryState({
        localStatus: "pending",
        receiptError: new Error("insufficient funds for gas * price + value"),
      }),
    ).toEqual({ status: "error", errorText: "Insufficient funds for this transaction" });
  });

  test("does not override non-pending local state with a stale receipt", () => {
    expect(
      deriveBuyPrimaryState({
        localErrorText: "Signature cancelled",
        localStatus: "error",
        receiptStatus: "success",
      }),
    ).toEqual({ status: "error", errorText: "Signature cancelled" });
  });
});

describe("refreshPurchaseReads", () => {
  test("refetches the native balance and invalidates active cached chain reads after purchase success", async () => {
    const refetchBalance = vi.fn().mockResolvedValue(undefined);
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);

    await refreshPurchaseReads({ invalidateQueries, refetchBalance });

    expect(refetchBalance).toHaveBeenCalledOnce();
    expect(invalidateQueries).toHaveBeenCalledOnce();
  });
});
