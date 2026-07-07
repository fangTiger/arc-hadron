"use client";

import { useMemo } from "react";
import { formatShares, formatUsdc } from "@/lib/format";
import { useBids } from "@/lib/hooks/useBids";
import { useListings } from "@/lib/hooks/useListings";
import { buildOrderBook, type OrderBook as OrderBookModel, type OrderBookLevel } from "@/lib/orderBook";
import { unitPriceToSharePrice } from "@/lib/shares";

export type OrderBookSide = "ask" | "bid";

interface OrderBookProps {
  tokenId: bigint;
  onSelectPrice?: (side: OrderBookSide) => void;
}

interface OrderBookViewProps {
  book: OrderBookModel;
  isLoading: boolean;
  onSelectPrice?: (side: OrderBookSide) => void;
}

export interface StackedOrderBookLevels {
  asks: OrderBookLevel[];
  bids: OrderBookLevel[];
}

export function stackLevels(
  bids: OrderBookLevel[],
  asks: OrderBookLevel[],
  options: { max: number },
): StackedOrderBookLevels {
  const bidLevels = bids.slice(0, options.max);
  const askLevels = asks.slice(0, options.max).reverse();

  return {
    asks: askLevels,
    bids: bidLevels,
  };
}

const ORDER_BOOK_LEVEL_LIMIT = 12;

function formatUnitPrice(price: bigint): string {
  if (price < 0n) {
    return `-${formatUsdc(unitPriceToSharePrice(-price))}`;
  }

  return formatUsdc(unitPriceToSharePrice(price));
}

function depthWidth(cum: bigint, maxCumulative: bigint): string {
  if (maxCumulative === 0n) {
    return "0%";
  }

  return `${((Number(cum) / Number(maxCumulative)) * 100).toFixed(2)}%`;
}

function displayedLevelCount(book: OrderBookModel): number {
  return (
    Math.min(book.bids.length, ORDER_BOOK_LEVEL_LIMIT) +
    Math.min(book.asks.length, ORDER_BOOK_LEVEL_LIMIT)
  );
}

function HeaderCell({
  children,
  className = "",
  role,
  side,
}: {
  children: string;
  className?: string;
  role: "price" | "size" | "total";
  side: OrderBookSide;
}) {
  return (
    <span
      className={className}
      data-column-role={role}
      data-header-side={side}
    >
      {children}
    </span>
  );
}

function SideHeader({ side }: { side: OrderBookSide }) {
  return (
    <div className="grid grid-cols-[minmax(5.5rem,1fr)_minmax(4.5rem,0.8fr)] border-b border-border bg-bg/60 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.16em] text-muted sm:grid-cols-[minmax(6rem,0.9fr)_minmax(5rem,0.7fr)_minmax(5rem,0.8fr)]">
      <HeaderCell role="price" side={side}>
        PRICE
      </HeaderCell>
      <HeaderCell className="text-right" role="size" side={side}>
        SIZE
      </HeaderCell>
      <HeaderCell className="text-right max-sm:hidden" role="total" side={side}>
        TOTAL
      </HeaderCell>
    </div>
  );
}

function DepthBar({
  level,
  maxCumulative,
  side,
}: {
  level: OrderBookLevel;
  maxCumulative: bigint;
  side: OrderBookSide;
}) {
  const isAsk = side === "ask";
  const anchorClassName = "right-0";
  const toneClassName = isAsk
    ? "bg-down/15 bg-linear-to-l from-down/20 to-down/5"
    : "bg-up/15 bg-linear-to-l from-up/20 to-up/5";

  return (
    <span
      aria-hidden="true"
      className={`absolute inset-y-0 ${anchorClassName} ${toneClassName} transition-[width] duration-300`}
      data-depth-bar={side}
      data-depth-price={level.price.toString()}
      style={{ width: depthWidth(level.cum, maxCumulative) }}
    />
  );
}

function OwnBadge() {
  return (
    <span
      className="border border-neon/40 bg-neon/10 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.14em] text-neon"
      data-own-badge="true"
    >
      You
    </span>
  );
}

function SizeCell({ level }: { level: OrderBookLevel }) {
  return (
    <span className="relative text-right text-text-dim">
      {formatShares(level.size)}
      <span className="ml-1 text-[9px] uppercase tracking-[0.12em] text-muted">x{level.count}</span>
    </span>
  );
}

function LevelRow({
  isBest,
  level,
  maxCumulative,
  onSelectPrice,
  side,
}: {
  isBest?: boolean;
  level: OrderBookLevel;
  maxCumulative: bigint;
  onSelectPrice?: (side: OrderBookSide) => void;
  side: OrderBookSide;
}) {
  const isAsk = side === "ask";
  const tone = isAsk ? "text-down" : "text-up";
  const hoverClassName = isAsk ? "hover:bg-down/10" : "hover:bg-up/10";
  const bestClassName = isBest
    ? isAsk
      ? "bg-down/10 shadow-[inset_2px_0_0_rgba(248,113,113,0.82)]"
      : "bg-up/10 shadow-[inset_-2px_0_0_rgba(52,211,153,0.82)]"
    : "";
  const buttonClassName = [
    "group relative grid min-h-[34px] w-full grid-cols-[minmax(5.5rem,1fr)_minmax(4.5rem,0.8fr)] overflow-hidden border-t border-border/70 px-3 py-1.5 font-mono text-[11px] tabular-nums transition-colors duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neon sm:grid-cols-[minmax(6rem,0.9fr)_minmax(5rem,0.7fr)_minmax(5rem,0.8fr)]",
    hoverClassName,
    bestClassName,
  ].join(" ");

  return (
    <button
      className={buttonClassName}
      data-price={level.price.toString()}
      data-best-level={isBest ? side : undefined}
      data-row-side={side}
      data-side={side}
      onClick={() => onSelectPrice?.(side)}
      type="button"
    >
      <DepthBar level={level} maxCumulative={maxCumulative} side={side} />
      <span className={`relative flex min-w-0 items-center gap-2 text-left ${tone}`}>
        <span>{formatUnitPrice(level.price)}</span>
        {level.isOwn ? <OwnBadge /> : null}
      </span>
      <SizeCell level={level} />
      <span className="relative text-right text-text max-sm:hidden" data-column-role="total">
        {formatShares(level.cum)}
      </span>
    </button>
  );
}

function SpreadRail({
  book,
  className = "",
}: {
  book: OrderBookModel;
  className?: string;
}) {
  if (book.mid === null || book.spread === null || book.spreadPct === null) {
    return (
      <div
        className={[
          "flex min-h-[42px] items-center justify-center border-y border-border bg-bg/70 px-3 py-2 text-center font-mono text-[12px] uppercase tracking-[0.16em] text-muted",
          className,
        ].join(" ")}
        data-spread-row="stacked"
        data-spread-state="empty"
      >
        —
      </div>
    );
  }

  return (
    <div
      className={[
        "flex min-h-[42px] items-center justify-center gap-3 border-y border-border bg-bg/75 px-3 py-2 text-center font-mono uppercase",
        className,
      ].join(" ")}
      data-spread-row="stacked"
      data-spread-state="ready"
    >
      <span className="text-sm tracking-[0.08em] text-text">MID {formatUnitPrice(book.mid)}</span>
      <span className="text-[10px] tracking-[0.14em] text-muted">SPREAD {formatUnitPrice(book.spread)}</span>
      <span className="text-[10px] tracking-[0.14em] text-muted">{book.spreadPct.toFixed(1)}%</span>
    </div>
  );
}

export function OrderBookView({ book, isLoading, onSelectPrice }: OrderBookViewProps) {
  const levels = stackLevels(book.bids, book.asks, { max: ORDER_BOOK_LEVEL_LIMIT });
  const hasOrders = levels.asks.length > 0 || levels.bids.length > 0;

  return (
    <section className="border border-border bg-panel p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-neon-dim">SECONDARY MARKET</p>
          <h2 className="mt-2 font-mono text-[11px] uppercase tracking-[0.2em] text-text">ORDER BOOK</h2>
        </div>
        <span className="border border-border bg-bg/60 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
          {isLoading ? "LOADING" : `${displayedLevelCount(book)} LEVELS`}
        </span>
      </div>

      <div
        className="mt-5 overflow-hidden border border-border bg-[linear-gradient(180deg,rgba(13,27,43,0.74),rgba(5,7,13,0.24))] shadow-[inset_0_1px_0_rgba(234,246,255,0.04)]"
        data-orderbook-layout="stacked"
        data-orderbook-surface="exchange-depth"
      >
        {hasOrders ? (
          <>
            <div data-ladder-section="asks">
              <SideHeader side="ask" />
              {levels.asks.map((level, index) => (
                <LevelRow
                  isBest={index === levels.asks.length - 1}
                  key={`ask:${level.price.toString()}`}
                  level={level}
                  maxCumulative={book.maxCumulative}
                  onSelectPrice={onSelectPrice}
                  side="ask"
                />
              ))}
            </div>
            <SpreadRail book={book} />
            <div data-ladder-section="bids">
              <SideHeader side="bid" />
              {levels.bids.map((level, index) => (
                <LevelRow
                  isBest={index === 0}
                  key={`bid:${level.price.toString()}`}
                  level={level}
                  maxCumulative={book.maxCumulative}
                  onSelectPrice={onSelectPrice}
                  side="bid"
                />
              ))}
            </div>
          </>
        ) : (
          <div className="px-4 py-8 text-center">
            <SpreadRail book={book} className="mx-auto mb-3 max-w-[220px] border border-border/70" />
            <p className="text-sm text-muted">No open orders</p>
          </div>
        )}
      </div>
    </section>
  );
}

export default function OrderBook({ onSelectPrice, tokenId }: OrderBookProps) {
  const { bids, isLoading: isBidsLoading } = useBids(tokenId);
  const { isLoading: isListingsLoading, listings } = useListings(tokenId);
  const book = useMemo(() => buildOrderBook({ bids, listings }), [bids, listings]);

  return (
    <OrderBookView
      book={book}
      isLoading={isBidsLoading || isListingsLoading}
      onSelectPrice={onSelectPrice}
    />
  );
}
