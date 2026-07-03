import { parseUsdc } from "@/lib/format";

export const SHARE_SCALE = 100n;

export function sharesFromUnits(units: bigint): number {
  if (units < 0n) {
    throw new Error("Shares cannot be negative.");
  }

  return Number(units) / Number(SHARE_SCALE);
}

export function unitsFromSharesInput(input: string): bigint {
  const normalized = input.trim();

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error("Enter a valid amount");
  }

  const [whole, fractional = ""] = normalized.split(".");
  const units = BigInt(whole) * SHARE_SCALE + BigInt(fractional.padEnd(2, "0"));

  if (units === 0n) {
    throw new Error("Enter a valid amount");
  }

  return units;
}

export function sharesInputFromUnits(units: bigint): string {
  if (units < 0n) {
    throw new Error("Shares cannot be negative.");
  }

  const whole = units / SHARE_SCALE;
  const fractional = units % SHARE_SCALE;

  if (fractional === 0n) {
    return whole.toString();
  }

  return `${whole.toString()}.${fractional.toString().padStart(2, "0").replace(/0+$/, "")}`;
}

export function unitPriceToSharePrice(pricePerUnit: bigint): bigint {
  if (pricePerUnit < 0n) {
    throw new Error("Price cannot be negative.");
  }

  return pricePerUnit * SHARE_SCALE;
}

export function sharePriceInputToUnitPrice(input: string): bigint {
  let sharePrice: bigint;

  try {
    sharePrice = parseUsdc(input);
  } catch {
    throw new Error("Enter a valid price");
  }

  if (sharePrice % SHARE_SCALE !== 0n) {
    throw new Error("Enter a valid price");
  }

  return sharePrice / SHARE_SCALE;
}
