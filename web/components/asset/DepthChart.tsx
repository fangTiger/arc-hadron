"use client";

import { useMemo } from "react";
import { formatUsdc } from "@/lib/format";
import { useBids } from "@/lib/hooks/useBids";
import { useListings } from "@/lib/hooks/useListings";
import {
  buildDepthSeries,
  buildOrderBook,
  type DepthPoint,
  type OrderBook as OrderBookModel,
} from "@/lib/orderBook";
import { unitPriceToSharePrice } from "@/lib/shares";

interface DepthChartProps {
  tokenId: bigint;
  variant?: DepthChartVariant;
}

interface DepthChartViewProps {
  book: OrderBookModel;
  isLoading: boolean;
  variant?: DepthChartVariant;
}

type DepthChartVariant = "default" | "compact";

interface ChartPoint {
  x: number;
  y: number;
}

const VIEWBOX_WIDTH = 320;
const VIEWBOX_HEIGHT = 160;
const MID_X = 160;
const LEFT_X = 18;
const RIGHT_X = 302;
const TOP_Y = 18;
const BOTTOM_Y = 126;
const UP_COLOR = "#34d399";
const DOWN_COLOR = "#f87171";
const GRID_Y = [42, 66, 90, 114];

function formatUnitPrice(price: bigint): string {
  return formatUsdc(unitPriceToSharePrice(price));
}

function priceDomain(points: DepthPoint[]): { min: bigint; max: bigint } | null {
  if (points.length === 0) {
    return null;
  }

  return points.reduce(
    (domain, point) => ({
      max: point.price > domain.max ? point.price : domain.max,
      min: point.price < domain.min ? point.price : domain.min,
    }),
    { max: points[0].price, min: points[0].price },
  );
}

function sideX({
  domain,
  price,
  side,
}: {
  domain: { min: bigint; max: bigint };
  price: bigint;
  side: "bid" | "ask";
}): number {
  if (domain.min === domain.max) {
    return side === "bid" ? LEFT_X : RIGHT_X;
  }

  const ratio = Number(price - domain.min) / Number(domain.max - domain.min);

  if (side === "bid") {
    return LEFT_X + ratio * (MID_X - LEFT_X);
  }

  return MID_X + ratio * (RIGHT_X - MID_X);
}

function depthY(cum: bigint, maxCumulative: bigint): number {
  if (maxCumulative === 0n) {
    return BOTTOM_Y;
  }

  return BOTTOM_Y - (Number(cum) / Number(maxCumulative)) * (BOTTOM_Y - TOP_Y);
}

function toChartPoints({
  domain,
  maxCumulative,
  points,
  side,
}: {
  domain: { min: bigint; max: bigint } | null;
  maxCumulative: bigint;
  points: DepthPoint[];
  side: "bid" | "ask";
}): ChartPoint[] {
  if (domain === null) {
    return [];
  }

  return points.map((point) => ({
    x: sideX({ domain, price: point.price, side }),
    y: depthY(point.cum, maxCumulative),
  }));
}

function stepLinePath(points: ChartPoint[]): string {
  if (points.length === 0) {
    return "";
  }

  const [first, ...rest] = points;
  const segments = [`M ${MID_X} ${first.y.toFixed(2)}`];

  for (const point of rest) {
    segments.push(`H ${point.x.toFixed(2)}`);
    segments.push(`V ${point.y.toFixed(2)}`);
  }

  if (rest.length === 0) {
    segments.push(`H ${first.x.toFixed(2)}`);
  }

  return segments.join(" ");
}

function stepAreaPath(points: ChartPoint[]): string {
  if (points.length === 0) {
    return "";
  }

  const line = stepLinePath(points);
  const last = points.at(-1) ?? points[0];

  return `M ${MID_X} ${BOTTOM_Y} L ${line.slice(2)} L ${last.x.toFixed(2)} ${BOTTOM_Y} Z`;
}

function endLabel(book: OrderBookModel, side: "left" | "right"): string {
  if (side === "left") {
    const lowestBid = book.bids.at(-1)?.price ?? book.asks[0]?.price;

    return lowestBid === undefined ? "—" : formatUnitPrice(lowestBid);
  }

  const highestAsk = book.asks.at(-1)?.price ?? book.bids[0]?.price;

  return highestAsk === undefined ? "—" : formatUnitPrice(highestAsk);
}

export function DepthChartView({ book, isLoading, variant = "default" }: DepthChartViewProps) {
  const series = buildDepthSeries(book);
  const bidDomain = priceDomain(series.bids);
  const askDomain = priceDomain(series.asks);
  const bidPoints = toChartPoints({
    domain: bidDomain,
    maxCumulative: book.maxCumulative,
    points: series.bids,
    side: "bid",
  });
  const askPoints = toChartPoints({
    domain: askDomain,
    maxCumulative: book.maxCumulative,
    points: series.asks,
    side: "ask",
  });
  const hasDepth = bidPoints.length > 0 || askPoints.length > 0;
  const isCompact = variant === "compact";
  const labelClassName = isCompact
    ? "sr-only"
    : "font-mono text-[10px] uppercase tracking-[0.2em] text-neon-dim";
  const headingClassName = isCompact
    ? "font-mono text-[10px] uppercase tracking-[0.08em] text-text"
    : "mt-2 font-mono text-[11px] uppercase tracking-[0.2em] text-text";
  const statusClassName = isCompact
    ? "border border-border bg-bg/60 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.08em] text-muted"
    : "border border-border bg-bg/60 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted";
  const chartShellClassName = isCompact
    ? "mt-2 border border-border bg-bg/35 p-1.5"
    : "mt-5 border border-border bg-bg/35 p-3";
  const chartClassName = isCompact ? "h-20 w-full" : "h-40 w-full";
  const emptyClassName = isCompact
    ? "mt-3 border border-dashed border-border bg-bg/35 p-4 text-center text-xs text-muted"
    : "mt-5 border border-dashed border-border bg-bg/35 p-6 text-center text-sm text-muted";
  const axisLabelsClassName = isCompact
    ? "mt-1.5 grid grid-cols-3 gap-2 font-mono text-[10px] tabular-nums tracking-normal text-muted"
    : "mt-3 grid grid-cols-3 gap-2 font-mono text-[10px] tabular-nums tracking-normal text-muted";
  const leftLabel = endLabel(book, "left");
  const midLabel = book.mid === null ? "MID —" : `MID ${formatUnitPrice(book.mid)}`;
  const rightLabel = endLabel(book, "right");
  const gradientSuffix = variant === "compact" ? "compact" : "default";
  const bidGradientId = `depth-bid-gradient-${gradientSuffix}`;
  const askGradientId = `depth-ask-gradient-${gradientSuffix}`;

  return (
    <section
      className={isCompact ? "border border-border bg-panel p-2.5 sm:p-3" : "border border-border bg-panel p-5 sm:p-6"}
      data-depth-chart-surface="exchange"
      data-depth-chart-variant={variant}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={labelClassName}>MARKET DEPTH</p>
          <h2 className={headingClassName}>DEPTH CHART</h2>
        </div>
        <span className={statusClassName}>
          {isLoading ? "LOADING" : `${series.bids.length + series.asks.length} POINTS`}
        </span>
      </div>

      {hasDepth ? (
        <div className={chartShellClassName}>
          <svg
            aria-label="Order book depth chart"
            className={chartClassName}
            preserveAspectRatio="xMidYMid meet"
            viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
            width="100%"
          >
            <defs>
              <linearGradient data-depth-gradient="bid" id={bidGradientId} x1="1" x2="0" y1="0" y2="0">
                <stop offset="0%" stopColor="rgba(52,211,153,0.32)" />
                <stop offset="100%" stopColor="rgba(52,211,153,0.04)" />
              </linearGradient>
              <linearGradient data-depth-gradient="ask" id={askGradientId} x1="0" x2="1" y1="0" y2="0">
                <stop offset="0%" stopColor="rgba(248,113,113,0.32)" />
                <stop offset="100%" stopColor="rgba(248,113,113,0.04)" />
              </linearGradient>
            </defs>
            {GRID_Y.map((y) => (
              <line
                data-depth-grid="horizontal"
                key={`grid:${y}`}
                stroke="rgba(28, 35, 51, 0.52)"
                strokeDasharray="2 6"
                x1={LEFT_X}
                x2={RIGHT_X}
                y1={y}
                y2={y}
              />
            ))}
            <line stroke="rgba(28, 35, 51, 0.86)" strokeDasharray="3 5" x1={MID_X} x2={MID_X} y1={TOP_Y} y2={BOTTOM_Y} />
            <line stroke="rgba(28, 35, 51, 0.78)" x1={LEFT_X} x2={RIGHT_X} y1={BOTTOM_Y} y2={BOTTOM_Y} />
            {bidPoints.length > 0 ? (
              <text fill={UP_COLOR} fontFamily="monospace" fontSize="8" x={LEFT_X} y="12">
                BEST BID
              </text>
            ) : null}
            {askPoints.length > 0 ? (
              <text fill={DOWN_COLOR} fontFamily="monospace" fontSize="8" textAnchor="end" x={RIGHT_X} y="12">
                BEST ASK
              </text>
            ) : null}
            {bidPoints.length > 0 ? (
              <>
                <path
                  d={stepAreaPath(bidPoints)}
                  data-depth-side="bid"
                  fill={`url(#${bidGradientId})`}
                  stroke="none"
                />
                <path d={stepLinePath(bidPoints)} fill="none" stroke={UP_COLOR} strokeWidth="2" />
              </>
            ) : null}
            {askPoints.length > 0 ? (
              <>
                <path
                  d={stepAreaPath(askPoints)}
                  data-depth-side="ask"
                  fill={`url(#${askGradientId})`}
                  stroke="none"
                />
                <path d={stepLinePath(askPoints)} fill="none" stroke={DOWN_COLOR} strokeWidth="2" />
              </>
            ) : null}
          </svg>
          <div className={axisLabelsClassName} data-depth-axis-labels>
            <span className="truncate text-left" data-depth-label="left">
              {leftLabel}
            </span>
            <span className="truncate text-center text-text-dim" data-depth-label="mid">
              {midLabel}
            </span>
            <span className="truncate text-right" data-depth-label="right">
              {rightLabel}
            </span>
          </div>
        </div>
      ) : (
        <div className={emptyClassName}>
          Awaiting order book depth
        </div>
      )}
    </section>
  );
}

export default function DepthChart({ tokenId, variant = "default" }: DepthChartProps) {
  const { bids, isLoading: isBidsLoading } = useBids(tokenId);
  const { isLoading: isListingsLoading, listings } = useListings(tokenId);
  const book = useMemo(() => buildOrderBook({ bids, listings }), [bids, listings]);

  return (
    <DepthChartView
      book={book}
      isLoading={isBidsLoading || isListingsLoading}
      variant={variant}
    />
  );
}
