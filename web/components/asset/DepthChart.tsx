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
}

interface DepthChartViewProps {
  book: OrderBookModel;
  isLoading: boolean;
}

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

export function DepthChartView({ book, isLoading }: DepthChartViewProps) {
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

  return (
    <section className="border border-border bg-panel p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-neon-dim">MARKET DEPTH</p>
          <h2 className="mt-2 font-mono text-[11px] uppercase tracking-[0.2em] text-text">DEPTH CHART</h2>
        </div>
        <span className="border border-border bg-bg/60 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
          {isLoading ? "LOADING" : `${series.bids.length + series.asks.length} POINTS`}
        </span>
      </div>

      {hasDepth ? (
        <div className="mt-5 border border-border bg-bg/35 p-3">
          <svg
            aria-label="Order book depth chart"
            className="h-40 w-full"
            preserveAspectRatio="none"
            viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
            width="100%"
          >
            <line stroke="rgba(28, 35, 51, 0.86)" strokeDasharray="3 5" x1={MID_X} x2={MID_X} y1={TOP_Y} y2={BOTTOM_Y} />
            <line stroke="rgba(28, 35, 51, 0.78)" x1={LEFT_X} x2={RIGHT_X} y1={BOTTOM_Y} y2={BOTTOM_Y} />
            {bidPoints.length > 0 ? (
              <>
                <path
                  d={stepAreaPath(bidPoints)}
                  data-depth-side="bid"
                  fill="rgba(52,211,153,0.18)"
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
                  fill="rgba(248,113,113,0.18)"
                  stroke="none"
                />
                <path d={stepLinePath(askPoints)} fill="none" stroke={DOWN_COLOR} strokeWidth="2" />
              </>
            ) : null}
            {book.mid !== null ? (
              <text
                fill="#9ca3af"
                fontFamily="var(--font-mono), ui-monospace, SFMono-Regular, Menlo, monospace"
                fontSize="10"
                textAnchor="middle"
                x={MID_X}
                y={148}
              >
                MID {formatUnitPrice(book.mid)}
              </text>
            ) : null}
            <text
              fill="#7d8591"
              fontFamily="var(--font-mono), ui-monospace, SFMono-Regular, Menlo, monospace"
              fontSize="10"
              textAnchor="start"
              x={LEFT_X}
              y={148}
            >
              {endLabel(book, "left")}
            </text>
            <text
              fill="#7d8591"
              fontFamily="var(--font-mono), ui-monospace, SFMono-Regular, Menlo, monospace"
              fontSize="10"
              textAnchor="end"
              x={RIGHT_X}
              y={148}
            >
              {endLabel(book, "right")}
            </text>
          </svg>
        </div>
      ) : (
        <div className="mt-5 border border-dashed border-border bg-bg/35 p-6 text-center text-sm text-muted">
          Awaiting order book depth
        </div>
      )}
    </section>
  );
}

export default function DepthChart({ tokenId }: DepthChartProps) {
  const { bids, isLoading: isBidsLoading } = useBids(tokenId);
  const { isLoading: isListingsLoading, listings } = useListings(tokenId);
  const book = useMemo(() => buildOrderBook({ bids, listings }), [bids, listings]);

  return <DepthChartView book={book} isLoading={isBidsLoading || isListingsLoading} />;
}
