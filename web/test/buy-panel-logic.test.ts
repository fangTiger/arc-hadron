import { describe, expect, test } from "vitest";
import { deriveBuyPrimaryState } from "../lib/hooks/useBuyPrimary";
import { GAS_BUFFER, mapWagmiError, validatePurchase } from "../lib/purchase";

const USDC = 10n ** 18n;

describe("validatePurchase", () => {
  test("合法整数数量返回购买数量与总价", () => {
    const result = validatePurchase({
      amountInput: "2",
      remaining: 10n,
      balance: 100n * USDC,
      pricePerShare: 3n * USDC,
    });

    expect(result).toEqual({
      ok: true,
      amount: 2n,
      totalValue: 6n * USDC,
    });
  });

  test("余额刚好覆盖总价与 gas 缓冲时通过校验", () => {
    const result = validatePurchase({
      amountInput: "1",
      remaining: 10n,
      balance: 2n * USDC + GAS_BUFFER,
      pricePerShare: 2n * USDC,
    });

    expect(result).toEqual({
      ok: true,
      amount: 1n,
      totalValue: 2n * USDC,
    });
  });

  test("空输入返回有效数量提示", () => {
    expect(
      validatePurchase({
        amountInput: "   ",
        remaining: 10n,
        balance: 100n * USDC,
        pricePerShare: USDC,
      }),
    ).toEqual({ ok: false, errorZh: "请输入有效的购买数量" });
  });

  test("非整数输入返回有效数量提示", () => {
    for (const amountInput of ["1.5", "abc", "-1"]) {
      expect(
        validatePurchase({
          amountInput,
          remaining: 10n,
          balance: 100n * USDC,
          pricePerShare: USDC,
        }),
      ).toEqual({ ok: false, errorZh: "请输入有效的购买数量" });
    }
  });

  test("0 数量返回有效数量提示", () => {
    expect(
      validatePurchase({
        amountInput: "0",
        remaining: 10n,
        balance: 100n * USDC,
        pricePerShare: USDC,
      }),
    ).toEqual({ ok: false, errorZh: "请输入有效的购买数量" });
  });

  test("购买数量超过发行余量时返回余量提示", () => {
    expect(
      validatePurchase({
        amountInput: "11",
        remaining: 10n,
        balance: 100n * USDC,
        pricePerShare: USDC,
      }),
    ).toEqual({ ok: false, errorZh: "超出发行余量" });
  });

  test("余额不足以覆盖总价与 gas 缓冲时返回余额提示", () => {
    expect(
      validatePurchase({
        amountInput: "1",
        remaining: 10n,
        balance: USDC + GAS_BUFFER - 1n,
        pricePerShare: USDC,
      }),
    ).toEqual({ ok: false, errorZh: "USDC 余额不足" });
  });
});

describe("mapWagmiError", () => {
  test("按错误名识别用户取消签名", () => {
    expect(mapWagmiError({ name: "UserRejectedRequestError" })).toBe("已取消签名");
  });

  test("错误名包含 User rejected 时识别为用户取消签名", () => {
    expect(mapWagmiError({ name: "User rejected by wallet" })).toBe("已取消签名");
  });

  test("按错误消息识别用户取消签名", () => {
    expect(mapWagmiError(new Error("User rejected the request."))).toBe("已取消签名");
  });

  test("识别 insufficient funds 余额错误", () => {
    expect(mapWagmiError(new Error("insufficient funds for gas * price + value"))).toBe(
      "余额不足以支付交易",
    );
  });

  test("未知错误返回通用失败提示", () => {
    expect(mapWagmiError(new Error("execution reverted"))).toBe("交易失败，请稍后重试");
  });
});

describe("deriveBuyPrimaryState", () => {
  test("pending 收到成功 receipt 时派生为 success", () => {
    expect(
      deriveBuyPrimaryState({
        localStatus: "pending",
        receiptStatus: "success",
      }),
    ).toEqual({ status: "success" });
  });

  test("pending 收到回滚 receipt 时派生为中文错误", () => {
    expect(
      deriveBuyPrimaryState({
        localStatus: "pending",
        receiptStatus: "reverted",
      }),
    ).toEqual({ status: "error", errorZh: "交易被链上回滚" });
  });

  test("pending 的 receipt 查询错误复用 wagmi 错误映射", () => {
    expect(
      deriveBuyPrimaryState({
        localStatus: "pending",
        receiptError: new Error("insufficient funds for gas * price + value"),
      }),
    ).toEqual({ status: "error", errorZh: "余额不足以支付交易" });
  });

  test("非 pending 本地状态不会被旧 receipt 覆盖", () => {
    expect(
      deriveBuyPrimaryState({
        localErrorZh: "已取消签名",
        localStatus: "error",
        receiptStatus: "success",
      }),
    ).toEqual({ status: "error", errorZh: "已取消签名" });
  });
});
