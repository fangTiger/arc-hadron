import type { AreaData, UTCTimestamp } from "lightweight-charts";
import type { PricePoint } from "@/lib/events";
import type { AssetView } from "@/lib/mappers";
import { unitPriceToSharePrice } from "@/lib/shares";

const USDC_SCALE = 10n ** 18n;

export type PriceAreaData = AreaData<UTCTimestamp>;

export function usdcValueFromWei(wei: bigint): number {
  if (wei < 0n) {
    throw new Error("Price cannot be negative.");
  }

  const whole = wei / USDC_SCALE;
  const fractional = wei % USDC_SCALE;

  return Number(whole) + Number(fractional) / Number(USDC_SCALE);
}

function unixSecondsFromMillis(timestampMs: number): UTCTimestamp {
  return Math.floor(timestampMs / 1000) as UTCTimestamp;
}

export function issueSharePriceForAsset(asset: AssetView): bigint {
  return unitPriceToSharePrice(asset.offering?.pricePerShare ?? 0n);
}

export function priceSeriesToAreaData(
  series: readonly PricePoint[],
  issueSharePrice: bigint,
): PriceAreaData[] {
  if (series.length === 0) {
    return [{ time: 0 as UTCTimestamp, value: usdcValueFromWei(issueSharePrice) }];
  }

  const pointsByTime = new Map<number, PriceAreaData>();

  for (const point of series) {
    const time = unixSecondsFromMillis(point.t);
    pointsByTime.set(time, {
      time,
      value: usdcValueFromWei(point.price),
    });
  }

  return [...pointsByTime.values()].sort((a, b) => Number(a.time) - Number(b.time));
}
