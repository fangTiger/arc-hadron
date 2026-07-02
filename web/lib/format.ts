const USDC_DECIMALS = BigInt(18);
const USDC_SCALE = BigInt(10) ** USDC_DECIMALS;

interface FormatUsdcOptions {
  compact?: boolean;
  digits?: number;
  raw?: boolean;
}

function assertDigits(digits: number) {
  if (!Number.isInteger(digits) || digits < 0 || digits > 6) {
    throw new Error("小数位数必须在 0 到 6 之间。");
  }
}

function groupThousands(value: string): string {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatFixed(wei: bigint, scale: bigint, digits: number, withThousands: boolean) {
  const integer = wei / scale;
  const remainder = wei % scale;
  const fractionalScale = BigInt(10) ** BigInt(digits);
  const fractional = digits === 0 ? BigInt(0) : (remainder * fractionalScale) / scale;
  const integerText = withThousands ? groupThousands(integer.toString()) : integer.toString();

  if (digits === 0) {
    return integerText;
  }

  return `${integerText}.${fractional.toString().padStart(digits, "0")}`;
}

export function formatUsdc(wei: bigint, opts: FormatUsdcOptions = {}): string {
  if (wei < BigInt(0)) {
    throw new Error("金额不能为负数。");
  }

  const requestedDigits = opts.digits ?? 2;
  assertDigits(requestedDigits);

  if (opts.compact) {
    const millionScale = USDC_SCALE * BigInt(1_000_000);
    const thousandScale = USDC_SCALE * BigInt(1_000);

    if (wei >= millionScale) {
      const digits = opts.digits ?? 2;
      assertDigits(digits);
      return `${formatFixed(wei, millionScale, digits, false)}M`;
    }

    if (wei >= thousandScale) {
      const digits = opts.digits ?? 1;
      assertDigits(digits);
      return `${formatFixed(wei, thousandScale, digits, false)}K`;
    }
  }

  return formatFixed(wei, USDC_SCALE, requestedDigits, opts.raw !== true);
}

export function parseUsdc(input: string): bigint {
  const normalized = input.trim();

  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error("请输入合法的 USDC 金额。");
  }

  const [whole, fractional = ""] = normalized.split(".");

  if (fractional.length > 18) {
    throw new Error("USDC 最多支持 18 位小数。");
  }

  return BigInt(whole) * USDC_SCALE + BigInt(fractional.padEnd(18, "0"));
}

export function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function formatShares(n: bigint): string {
  if (n < BigInt(0)) {
    throw new Error("份额不能为负数。");
  }

  return groupThousands(n.toString());
}
