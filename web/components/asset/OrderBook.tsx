"use client";

import { useMemo, type CSSProperties } from "react";
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

export interface PairedOrderBookLevel {
  bid: OrderBookLevel | null;
  ask: OrderBookLevel | null;
}

export function pairLevels(
  bids: OrderBookLevel[],
  asks: OrderBookLevel[],
  options: { max: number },
): PairedOrderBookLevel[] {
  const bidLevels = bids.slice(0, options.max);
  const askLevels = asks.slice(0, options.max);
  const rowCount = Math.max(bidLevels.length, askLevels.length);

  return Array.from({ length: rowCount }, (_, index) => ({
    ask: askLevels[index] ?? null,
    bid: bidLevels[index] ?? null,
  }));
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
  if (side === "bid") {
    return (
      <div className="grid grid-cols-2 border-b border-border bg-bg/60 px-2 py-2 font-mono text-[9px] uppercase tracking-[0.16em] text-muted sm:grid-cols-3">
        <HeaderCell className="max-sm:hidden" role="total" side="bid">
          TOTAL
        </HeaderCell>
        <HeaderCell className="text-right" role="size" side="bid">
          SIZE
        </HeaderCell>
        <HeaderCell className="text-right" role="price" side="bid">
          PRICE
        </HeaderCell>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 border-b border-border bg-bg/60 px-2 py-2 font-mono text-[9px] uppercase tracking-[0.16em] text-muted sm:grid-cols-3">
      <HeaderCell role="price" side="ask">
        PRICE
      </HeaderCell>
      <HeaderCell className="text-right" role="size" side="ask">
        SIZE
      </HeaderCell>
      <HeaderCell className="text-right max-sm:hidden" role="total" side="ask">
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
  const anchorClassName = isAsk ? "left-0" : "right-0";
  const toneClassName = isAsk ? "bg-down/15" : "bg-up/15";

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

function EmptySideRow({ side }: { side: OrderBookSide }) {
  const sideClassName =
    side === "bid"
      ? "grid-cols-2 px-2 sm:grid-cols-3"
      : "grid-cols-2 px-2 sm:grid-cols-3";

  return (
    <div
      aria-hidden="true"
      className={`grid min-h-[42px] border-t border-border/70 bg-bg/15 py-2 ${sideClassName}`}
      data-empty-side={side}
    >
      {side === "bid" ? (
        <>
          <span className="max-sm:hidden" data-column-role="total" />
          <span />
          <span />
        </>
      ) : (
        <>
          <span />
          <span />
          <span className="max-sm:hidden" data-column-role="total" />
        </>
      )}
    </div>
  );
}

function LevelRow({
  level,
  maxCumulative,
  onSelectPrice,
  side,
}: {
  level: OrderBookLevel | null;
  maxCumulative: bigint;
  onSelectPrice?: (side: OrderBookSide) => void;
  side: OrderBookSide;
}) {
  if (level === null) {
    return <EmptySideRow side={side} />;
  }

  const isAsk = side === "ask";
  const tone = isAsk ? "text-down" : "text-up";
  const hoverClassName = isAsk ? "hover:bg-down/10" : "hover:bg-up/10";
  const buttonClassName = [
    "group relative grid min-h-[42px] w-full grid-cols-2 overflow-hidden border-t border-border/70 px-2 py-2 font-mono text-[11px] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neon sm:grid-cols-3",
    hoverClassName,
  ].join(" ");

  if (side === "bid") {
    return (
      <button
        className={buttonClassName}
        data-price={level.price.toString()}
        data-row-side="bid"
        data-side="bid"
        onClick={() => onSelectPrice?.("bid")}
        type="button"
      >
        <DepthBar level={level} maxCumulative={maxCumulative} side="bid" />
        <span className="relative max-sm:hidden text-left text-text" data-column-role="total">
          {formatShares(level.cum)}
        </span>
        <SizeCell level={level} />
        <span className={`relative flex min-w-0 items-center justify-end gap-2 text-right ${tone}`}>
          <span>{formatUnitPrice(level.price)}</span>
          {level.isOwn ? <OwnBadge /> : null}
        </span>
      </button>
    );
  }

  return (
    <button
      className={buttonClassName}
      data-price={level.price.toString()}
      data-row-side="ask"
      data-side="ask"
      onClick={() => onSelectPrice?.("ask")}
      type="button"
    >
      <DepthBar level={level} maxCumulative={maxCumulative} side="ask" />
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
  style,
}: {
  book: OrderBookModel;
  className?: string;
  style?: CSSProperties;
}) {
  if (book.mid === null || book.spread === null || book.spreadPct === null) {
    return (
      <div
        className={[
          "flex min-h-[42px] flex-col items-center justify-center border-x border-t border-border/70 bg-bg/55 px-1 py-2 text-center font-mono text-[12px] uppercase tracking-[0.16em] text-muted",
          className,
        ].join(" ")}
        data-spread-state="empty"
        style={style}
      >
        —
      </div>
    );
  }

  return (
    <div
      className={[
        "flex min-h-[42px] flex-col items-center justify-center gap-1 border-x border-t border-border/70 bg-bg/70 px-1 py-2 text-center font-mono uppercase",
        className,
      ].join(" ")}
      data-spread-state="ready"
      style={style}
    >
      <span className="text-[10px] tracking-[0.14em] text-text">MID {formatUnitPrice(book.mid)}</span>
      <span className="text-[10px] tracking-[0.14em] text-muted">SPREAD {formatUnitPrice(book.spread)}</span>
      <span className="text-[10px] tracking-[0.14em] text-muted">{book.spreadPct.toFixed(1)}%</span>
    </div>
  );
}

export function OrderBookView({ book, isLoading, onSelectPrice }: OrderBookViewProps) {
  const pairs = pairLevels(book.bids, book.asks, { max: ORDER_BOOK_LEVEL_LIMIT });
  const hasOrders = pairs.length > 0;
  const spreadStyle: CSSProperties = {
    gridColumn: "2",
    gridRow: `2 / span ${Math.max(pairs.length, 1)}`,
  };

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
        className="mt-5 grid grid-cols-[minmax(0,1fr)_72px_minmax(0,1fr)] overflow-hidden border border-border bg-bg/35 sm:grid-cols-[minmax(0,1fr)_92px_minmax(0,1fr)]"
        data-orderbook-layout="bilateral"
      >
        <SideHeader side="bid" />
        <div className="border-x border-b border-border bg-bg/60 px-1 py-2 text-center font-mono text-[9px] uppercase tracking-[0.16em] text-muted">
          SPREAD
        </div>
        <SideHeader side="ask" />

        {hasOrders ? (
          pairs.map((pair, index) => (
            <div className="contents" data-pair-index={index.toString()} key={`pair:${index}`}>
              <LevelRow
                level={pair.bid}
                maxCumulative={book.maxCumulative}
                onSelectPrice={onSelectPrice}
                side="bid"
              />
              {index === 0 ? <SpreadRail book={book} style={spreadStyle} /> : null}
              <LevelRow
                level={pair.ask}
                maxCumulative={book.maxCumulative}
                onSelectPrice={onSelectPrice}
                side="ask"
              />
            </div>
          ))
        ) : (
          <div className="col-span-3 px-4 py-8 text-center">
            <SpreadRail book={book} className="mx-auto mb-3 max-w-[92px] border border-border/70" />
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
