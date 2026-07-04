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

function OrderBookRow({
  level,
  maxCumulative,
  onSelectPrice,
  side,
}: {
  level: OrderBookLevel;
  maxCumulative: bigint;
  onSelectPrice?: (side: OrderBookSide) => void;
  side: OrderBookSide;
}) {
  const isAsk = side === "ask";
  const tone = isAsk ? "text-down" : "text-up";
  const barClassName = isAsk ? "bg-down/15" : "bg-up/15";
  const hoverClassName = isAsk ? "hover:bg-down/10" : "hover:bg-up/10";

  return (
    <button
      className={[
        "group relative grid w-full grid-cols-3 overflow-hidden border-t border-border/70 px-3 py-2 text-left font-mono text-[11px] transition-colors duration-200",
        hoverClassName,
      ].join(" ")}
      data-price={level.price.toString()}
      data-side={side}
      onClick={() => onSelectPrice?.(side)}
      type="button"
    >
      <span
        aria-hidden="true"
        className={`absolute inset-y-0 right-0 ${barClassName} transition-[width] duration-300`}
        style={{ width: depthWidth(level.cum, maxCumulative) }}
      />
      <span className={`relative flex min-w-0 items-center gap-2 ${tone}`}>
        <span>{formatUnitPrice(level.price)}</span>
        {level.isOwn ? (
          <span className="border border-neon/40 bg-neon/10 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.14em] text-neon">
            You
          </span>
        ) : null}
      </span>
      <span className="relative text-right text-text-dim">
        {formatShares(level.size)}
        <span className="ml-1 text-[9px] uppercase tracking-[0.12em] text-muted">x{level.count}</span>
      </span>
      <span className="relative text-right text-text">{formatShares(level.cum)}</span>
    </button>
  );
}

function SpreadRow({ book }: { book: OrderBookModel }) {
  if (book.mid === null || book.spread === null || book.spreadPct === null) {
    return (
      <div className="border-y border-border bg-bg/60 px-3 py-3 text-center font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
        —
      </div>
    );
  }

  return (
    <div className="border-y border-border bg-bg/70 px-3 py-3 font-mono uppercase">
      <div className="flex flex-col gap-1 text-center">
        <span className="text-[11px] tracking-[0.16em] text-text">MID {formatUnitPrice(book.mid)}</span>
        <span className="text-[10px] tracking-[0.16em] text-muted">
          SPREAD {formatUnitPrice(book.spread)} ({book.spreadPct.toFixed(1)}%)
        </span>
      </div>
    </div>
  );
}

export function OrderBookView({ book, isLoading, onSelectPrice }: OrderBookViewProps) {
  const askRows = [...book.asks].reverse();
  const hasOrders = book.asks.length > 0 || book.bids.length > 0;

  return (
    <section className="border border-border bg-panel p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-neon-dim">SECONDARY MARKET</p>
          <h2 className="mt-2 font-mono text-[11px] uppercase tracking-[0.2em] text-text">ORDER BOOK</h2>
        </div>
        <span className="border border-border bg-bg/60 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
          {isLoading ? "LOADING" : `${book.asks.length + book.bids.length} LEVELS`}
        </span>
      </div>

      <div className="mt-5 border border-border bg-bg/35">
        <div className="grid grid-cols-3 border-b border-border bg-bg/60 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.18em] text-muted">
          <span>PRICE</span>
          <span className="text-right">SIZE</span>
          <span className="text-right">TOTAL</span>
        </div>

        {hasOrders ? (
          <>
            <div>
              {askRows.map((level) => (
                <OrderBookRow
                  key={`ask:${level.price.toString()}`}
                  level={level}
                  maxCumulative={book.maxCumulative}
                  onSelectPrice={onSelectPrice}
                  side="ask"
                />
              ))}
            </div>
            <SpreadRow book={book} />
            <div>
              {book.bids.map((level) => (
                <OrderBookRow
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
          <div className="px-4 py-8 text-center text-sm text-muted">No open orders</div>
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
