import { describe, expect, test } from "vitest";
import { formatShares, formatUsdc, parseUsdc, shortAddress } from "../lib/format";

const USDC = 10n ** 18n;

describe("USDC 18-decimal formatting", () => {
  test("formats zero with two decimals by default", () => {
    expect(formatUsdc(0n)).toBe("0.00");
  });

  test("formats integer amounts with two decimals by default", () => {
    expect(formatUsdc(100n * USDC)).toBe("100.00");
  });

  test("truncates decimal amounts to the requested digits instead of rounding", () => {
    expect(formatUsdc(1234567890000000000n, { digits: 2 })).toBe("1.23");
    expect(formatUsdc(1234567890000000000n, { digits: 6 })).toBe("1.234567");
  });

  test("supports digits from 0 to 6", () => {
    expect(formatUsdc(1850000000000000000n, { digits: 0 })).toBe("1");
    expect(() => formatUsdc(1n, { digits: 7 })).toThrow("Decimal digits must be between 0 and 6.");
  });

  test("uses thousands separators outside raw mode", () => {
    expect(formatUsdc(1234567890000000000000n)).toBe("1,234.56");
  });

  test("does not use thousands separators in raw mode", () => {
    expect(formatUsdc(1234567890000000000000n, { raw: true })).toBe("1234.56");
  });

  test("uses K and M suffixes in compact mode", () => {
    expect(formatUsdc(184200n * USDC, { compact: true })).toBe("184.2K");
    expect(formatUsdc(2400000n * USDC, { compact: true })).toBe("2.40M");
  });

  test("rejects negative amounts", () => {
    expect(() => formatUsdc(-1n)).toThrow("Amount cannot be negative.");
  });
});

describe("USDC 18-decimal parsing", () => {
  test("parses integer, decimal, and dust amounts", () => {
    expect(parseUsdc("100")).toBe(100n * USDC);
    expect(parseUsdc("1.85")).toBe(1850000000000000000n);
    expect(parseUsdc("0.000001")).toBe(1000000000000n);
  });

  test("supports up to 18 decimal places", () => {
    expect(parseUsdc("0.000000000000000001")).toBe(1n);
    expect(() => parseUsdc("0.0000000000000000001")).toThrow(
      "USDC supports at most 18 decimal places.",
    );
  });

  test("rejects blank, nonnumeric, negative, multi-decimal, and comma inputs", () => {
    for (const input of ["", "abc", "-1", "1.2.3", "1,000.00"]) {
      expect(() => parseUsdc(input)).toThrow("Enter a valid USDC amount.");
    }
  });

  test("round-trips integer USDC from raw formatting with six decimal places", () => {
    const value = 1234567n * USDC;
    expect(parseUsdc(formatUsdc(value, { digits: 6, raw: true }))).toBe(value);
  });
});

describe("address and share formatting", () => {
  test("shortAddress keeps the first 6 and last 4 characters", () => {
    expect(shortAddress("0x4D82b6e528D3c2E1a3592e14863ec95EAeF4Ff85")).toBe(
      "0x4D82…Ff85",
    );
  });

  test("formatShares uses integer thousands separators", () => {
    expect(formatShares(1234567890n)).toBe("1,234,567,890");
  });
});
