import { describe, expect, test } from "vitest";
import { formatShares, formatUsdc, parseUsdc, shortAddress } from "../lib/format";

const USDC = 10n ** 18n;

describe("USDC 18 位金额格式化", () => {
  test("0 默认显示两位小数", () => {
    expect(formatUsdc(0n)).toBe("0.00");
  });

  test("整数金额默认显示两位小数", () => {
    expect(formatUsdc(100n * USDC)).toBe("100.00");
  });

  test("小数金额按指定位数截断而非四舍五入", () => {
    expect(formatUsdc(1234567890000000000n, { digits: 2 })).toBe("1.23");
    expect(formatUsdc(1234567890000000000n, { digits: 6 })).toBe("1.234567");
  });

  test("digits 支持 0 到 6 位", () => {
    expect(formatUsdc(1850000000000000000n, { digits: 0 })).toBe("1");
    expect(() => formatUsdc(1n, { digits: 7 })).toThrow("小数位数必须在 0 到 6 之间。");
  });

  test("非 raw 模式使用千分位逗号", () => {
    expect(formatUsdc(1234567890000000000000n)).toBe("1,234.56");
  });

  test("raw 模式不使用千分位逗号", () => {
    expect(formatUsdc(1234567890000000000000n, { raw: true })).toBe("1234.56");
  });

  test("compact 模式显示 K 与 M", () => {
    expect(formatUsdc(184200n * USDC, { compact: true })).toBe("184.2K");
    expect(formatUsdc(2400000n * USDC, { compact: true })).toBe("2.40M");
  });

  test("负数金额拒绝格式化", () => {
    expect(() => formatUsdc(-1n)).toThrow("金额不能为负数。");
  });
});

describe("USDC 18 位金额解析", () => {
  test("解析整数、小数与微小金额", () => {
    expect(parseUsdc("100")).toBe(100n * USDC);
    expect(parseUsdc("1.85")).toBe(1850000000000000000n);
    expect(parseUsdc("0.000001")).toBe(1000000000000n);
  });

  test("最多支持 18 位小数", () => {
    expect(parseUsdc("0.000000000000000001")).toBe(1n);
    expect(() => parseUsdc("0.0000000000000000001")).toThrow(
      "USDC 最多支持 18 位小数。",
    );
  });

  test("拒绝空串、非数字、负号、多个小数点与逗号", () => {
    for (const input of ["", "abc", "-1", "1.2.3", "1,000.00"]) {
      expect(() => parseUsdc(input)).toThrow("请输入合法的 USDC 金额。");
    }
  });

  test("raw 格式化结果可按 6 位小数往返解析整数 USDC", () => {
    const value = 1234567n * USDC;
    expect(parseUsdc(formatUsdc(value, { digits: 6, raw: true }))).toBe(value);
  });
});

describe("地址与份额格式化", () => {
  test("shortAddress 保留前 6 后 4", () => {
    expect(shortAddress("0x4D82b6e528D3c2E1a3592e14863ec95EAeF4Ff85")).toBe(
      "0x4D82…Ff85",
    );
  });

  test("formatShares 使用整数千分位", () => {
    expect(formatShares(1234567890n)).toBe("1,234,567,890");
  });
});
