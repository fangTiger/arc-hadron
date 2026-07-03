"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { categoryDisplay } from "@/lib/categories";
import type { TradeEvent } from "@/lib/events";
import { formatShares, formatUsdc } from "@/lib/format";
import {
  assetChange24h,
  fallbackPriceForAsset,
  formatApyBps,
  latestPriceForAsset,
  priceSeriesForAsset,
} from "@/lib/marketMetrics";
import type { AssetView } from "@/lib/mappers";
import { unitPriceToSharePrice } from "@/lib/shares";
import {
  handleRowNavigationKeyDown,
  navigateToHref,
  stopRowNavigation,
} from "@/lib/rowNavigation";

type SortKey = "price" | "yield" | "available" | "mktcap";
type SortDirection = "asc" | "desc";

interface MarketRow {
  asset: AssetView;
  available: bigint;
  changePct: number;
  marketCap: bigint;
  price: bigint;
  yieldBps: number | null;
}

const SORT_LABELS: Record<SortKey, string> = {
  available: "AVAILABLE",
  mktcap: "MKT CAP",
  price: "PRICE (USDC)",
  yield: "YIELD",
};

function compareBigInt(a: bigint, b: bigint): number {
  if (a === b) {
    return 0;
  }

  return a > b ? 1 : -1;
}

function rowValue(row: MarketRow, key: SortKey): bigint | number {
  if (key === "price") {
    return row.price;
  }

  if (key === "available") {
    return row.available;
  }

  if (key === "mktcap") {
    return row.marketCap;
  }

  return row.yieldBps ?? -1;
}

function sortRows(rows: MarketRow[], key: SortKey, direction: SortDirection): MarketRow[] {
  const multiplier = direction === "asc" ? 1 : -1;

  return [...rows].sort((a, b) => {
    const aValue = rowValue(a, key);
    const bValue = rowValue(b, key);
    const compared =
      typeof aValue === "bigint" && typeof bValue === "bigint"
        ? compareBigInt(aValue, bValue)
        : Number(aValue) - Number(bValue);

    if (compared !== 0) {
      return compared * multiplier;
    }

    return a.asset.meta.displayName.localeCompare(b.asset.meta.displayName);
  });
}

function changeClassName(changePct: number): string {
  if (changePct > 0) {
    return "text-up";
  }

  if (changePct < 0) {
    return "text-down";
  }

  return "text-muted";
}

function TrendLine({
  asset,
  events,
}: {
  asset: AssetView;
  events: TradeEvent[];
}) {
  const series = priceSeriesForAsset(asset, events);
  const prices = series.map((point) => Number(point.price));
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min || 1;
  const points = series
    .map((point, index) => {
      const x = series.length === 1 ? 0 : (index / (series.length - 1)) * 40;
      const y = 15 - ((Number(point.price) - min) / span) * 14;

      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const first = series[0]?.price ?? fallbackPriceForAsset(asset);
  const last = series.at(-1)?.price ?? first;
  const stroke = last > first ? "var(--up)" : last < first ? "var(--down)" : "var(--muted)";

  return (
    <svg aria-label={`${asset.meta.ticker} trend`} className="h-4 w-10" viewBox="0 0 40 16">
      <polyline
        fill="none"
        points={points}
        stroke={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function SortHeader({
  active,
  direction,
  label,
  onClick,
}: {
  active: boolean;
  direction: SortDirection;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="inline-flex items-center gap-1 text-left font-mono text-[10px] uppercase tracking-[0.16em] text-muted transition-colors hover:text-text"
      onClick={onClick}
      type="button"
    >
      <span>{label}</span>
      <span className={active ? "text-neon" : "text-muted/50"}>{active ? (direction === "asc" ? "↑" : "↓") : "↕"}</span>
    </button>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 6 }, (_, index) => (
        <tr className="border-b border-border" key={index}>
          {Array.from({ length: 8 }, (_, cellIndex) => (
            <td className="px-4 py-4" key={cellIndex}>
              <Skeleton className="h-4 w-full max-w-28" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function MarketTable({
  assets,
  errorText,
  events,
  isLoading,
  nowMs,
}: {
  assets: AssetView[];
  errorText?: string;
  events: TradeEvent[];
  isLoading: boolean;
  nowMs: number;
}) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>("mktcap");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  function updateSort(nextKey: SortKey) {
    if (nextKey === sortKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection("desc");
  }

  return (
    <MarketTableView
      assets={assets}
      errorText={errorText}
      events={events}
      isLoading={isLoading}
      nowMs={nowMs}
      onNavigate={(href) => router.push(href)}
      onSort={updateSort}
      sortDirection={sortDirection}
      sortKey={sortKey}
    />
  );
}

export function MarketTableView({
  assets,
  errorText,
  events,
  isLoading,
  nowMs,
  onSort = () => undefined,
  onNavigate = navigateToHref,
  sortDirection = "desc",
  sortKey = "mktcap",
}: {
  assets: AssetView[];
  errorText?: string;
  events: TradeEvent[];
  isLoading: boolean;
  nowMs: number;
  onNavigate?: (href: string) => void;
  onSort?: (key: SortKey) => void;
  sortDirection?: SortDirection;
  sortKey?: SortKey;
}) {
  const rows = useMemo(
    () =>
      sortRows(
        assets.map((asset) => {
          const price = latestPriceForAsset(asset, events);
          const available = asset.offering?.remaining ?? 0n;

          return {
            asset,
            available,
            changePct: assetChange24h(asset, events, nowMs).changePct,
            marketCap: asset.totalShares * price,
            price,
            yieldBps: asset.meta.apyBps,
          };
        }),
        sortKey,
        sortDirection,
      ),
    [assets, events, nowMs, sortDirection, sortKey],
  );

  return (
    <section className="overflow-hidden border border-border bg-panel/80">
      <div className="overflow-x-auto">
        <table className="min-w-[980px] w-full border-collapse">
          <thead className="border-b border-border bg-bg/70">
            <tr>
              <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                ASSET
              </th>
              <th className="px-4 py-3 text-left">
                <SortHeader
                  active={sortKey === "price"}
                  direction={sortDirection}
                  label={SORT_LABELS.price}
                  onClick={() => onSort("price")}
                />
              </th>
              <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                24H
              </th>
              {(["yield", "available", "mktcap"] as SortKey[]).map((key) => (
                <th className="px-4 py-3 text-left" key={key}>
                  <SortHeader
                    active={sortKey === key}
                    direction={sortDirection}
                    label={SORT_LABELS[key]}
                    onClick={() => onSort(key)}
                  />
                </th>
              ))}
              <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                TREND
              </th>
              <th className="px-4 py-3 text-right font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                TRADE
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <SkeletonRows /> : null}
            {!isLoading && errorText ? (
              <tr>
                <td className="px-4 py-8 text-sm text-down" colSpan={8}>
                  {errorText}
                </td>
              </tr>
            ) : null}
            {!isLoading && !errorText && rows.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-sm text-muted" colSpan={8}>
                  No assets match this market filter.
                </td>
              </tr>
            ) : null}
            {!isLoading && !errorText
              ? rows.map((row) => {
                  const category = categoryDisplay(row.asset.category);
                  const assetHref = `/asset/${row.asset.tokenId.toString()}`;

                  return (
                    <tr
                      aria-label={`Open ${row.asset.meta.displayName}`}
                      className="cursor-pointer border-b border-border/80 transition-colors last:border-b-0 hover:bg-border-glow/18"
                      key={row.asset.tokenId.toString()}
                      onClick={() => onNavigate(assetHref)}
                      onKeyDown={(event) => handleRowNavigationKeyDown(event, assetHref, onNavigate)}
                      role="link"
                      tabIndex={0}
                    >
                      <td className="px-4 py-4">
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className={[
                              "shrink-0 border px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em]",
                              category.tickerClassName,
                            ].join(" ")}
                          >
                            {row.asset.meta.ticker}
                          </span>
                          <span className="truncate text-sm text-text">{row.asset.meta.displayName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 font-mono text-sm text-text">
                        {formatUsdc(unitPriceToSharePrice(row.price))}
                      </td>
                      <td className={["px-4 py-4 font-mono text-sm", changeClassName(row.changePct)].join(" ")}>
                        {row.changePct.toFixed(2)}%
                      </td>
                      <td className="px-4 py-4 font-mono text-sm text-gold">
                        {formatApyBps(row.yieldBps)}
                      </td>
                      <td className="px-4 py-4 font-mono text-sm text-text-dim">
                        {formatShares(row.available)}
                      </td>
                      <td className="px-4 py-4 font-mono text-sm text-text">
                        {formatUsdc(row.marketCap, { compact: true })}
                      </td>
                      <td className="px-4 py-4">
                        <TrendLine asset={row.asset} events={events} />
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Link
                          className="inline-flex h-8 items-center justify-center bg-[#0e7490] px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-white transition-colors hover:bg-[#155e75]"
                          href={assetHref}
                          onClick={stopRowNavigation}
                        >
                          Trade
                        </Link>
                      </td>
                    </tr>
                  );
                })
              : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
