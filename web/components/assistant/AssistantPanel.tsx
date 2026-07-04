"use client";

import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { BuyConfirmCard, type BuyConfirmCardProps } from "@/components/assistant/BuyConfirmCard";
import { formatShares, formatUsdc } from "@/lib/format";
import { unitPriceToSharePrice } from "@/lib/shares";

export type AssistantDepthLevel = {
  price: bigint;
  size: bigint;
};

export type AssistantCard =
  | {
      type: "price";
      assetLabel: string;
      primaryPrice: bigint | null;
      bestAsk: bigint | null;
      bestBid: bigint | null;
    }
  | {
      type: "depth";
      assetLabel: string;
      asks: AssistantDepthLevel[];
      bids: AssistantDepthLevel[];
    }
  | {
      type: "holdings";
      isConnected: boolean;
      rows: Array<{ assetLabel: string; balance: bigint; marketValue: bigint }>;
    }
  | {
      type: "yield";
      isConnected: boolean;
      totalPending: bigint;
      rows: Array<{ assetLabel: string; pending: bigint }>;
    }
  | ({ type: "buy" } & BuyConfirmCardProps)
  | { type: "unknown" }
  | {
      type: "asset_ambiguous";
      query: string;
      candidates: Array<{ tokenId: bigint | number | string; label: string; ticker?: string }>;
    }
  | { type: "asset_not_found"; query: string };

export interface AssistantPanelViewProps {
  cards: AssistantCard[];
  defaultAssetLabel?: string | null;
  errorText: string | null;
  inputValue: string;
  isOpen: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
}

function unitPriceText(price: bigint | null): string {
  return price === null ? "—" : `${formatUsdc(unitPriceToSharePrice(price))} USDC`;
}

function CardShell({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="border border-border bg-bg/60 p-4">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-neon-dim">{title}</h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-border py-3 first:border-t-0 first:pt-0 last:pb-0">
      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">{label}</dt>
      <dd className="font-mono text-sm text-text">{value}</dd>
    </div>
  );
}

function PriceCard({ card }: { card: Extract<AssistantCard, { type: "price" }> }) {
  return (
    <CardShell title={`PRICE / ${card.assetLabel}`}>
      <dl>
        <StatRow label="PRIMARY" value={unitPriceText(card.primaryPrice)} />
        <StatRow label="LOWEST ASK" value={unitPriceText(card.bestAsk)} />
        <StatRow label="HIGHEST BID" value={unitPriceText(card.bestBid)} />
      </dl>
    </CardShell>
  );
}

function DepthRows({
  levels,
  title,
}: {
  levels: AssistantDepthLevel[];
  title: string;
}) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">{title}</p>
      <div className="mt-2 divide-y divide-border border border-border">
        {levels.length === 0 ? (
          <p className="px-3 py-3 text-sm text-muted">No active orders</p>
        ) : (
          levels.map((level) => (
            <div
              className="grid grid-cols-2 gap-3 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.12em]"
              key={`${title}:${level.price.toString()}:${level.size.toString()}`}
            >
              <span className="text-text">{unitPriceText(level.price)}</span>
              <span className="text-right text-text-dim">{formatShares(level.size)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function DepthCard({ card }: { card: Extract<AssistantCard, { type: "depth" }> }) {
  return (
    <CardShell title={`DEPTH / ${card.assetLabel}`}>
      <div className="grid gap-4 sm:grid-cols-2">
        <DepthRows levels={card.asks} title="ASKS" />
        <DepthRows levels={card.bids} title="BIDS" />
      </div>
    </CardShell>
  );
}

function HoldingsCard({ card }: { card: Extract<AssistantCard, { type: "holdings" }> }) {
  if (!card.isConnected) {
    return (
      <CardShell title="HOLDINGS">
        <p className="text-sm leading-6 text-text-dim">Connect wallet to view your holdings</p>
      </CardShell>
    );
  }

  return (
    <CardShell title="HOLDINGS">
      {card.rows.length === 0 ? (
        <p className="text-sm leading-6 text-muted">No holdings found</p>
      ) : (
        <dl>
          {card.rows.map((row) => (
            <StatRow
              key={row.assetLabel}
              label={row.assetLabel}
              value={`${formatShares(row.balance)} / ${formatUsdc(row.marketValue)} USDC`}
            />
          ))}
        </dl>
      )}
    </CardShell>
  );
}

function YieldCard({ card }: { card: Extract<AssistantCard, { type: "yield" }> }) {
  if (!card.isConnected) {
    return (
      <CardShell title="YIELD">
        <p className="text-sm leading-6 text-text-dim">Connect wallet to view your yield</p>
      </CardShell>
    );
  }

  return (
    <CardShell title="YIELD">
      <dl>
        <StatRow label="UNCLAIMED TOTAL" value={`${formatUsdc(card.totalPending)} USDC`} />
        {card.rows.map((row) => (
          <StatRow
            key={row.assetLabel}
            label={row.assetLabel}
            value={`${formatUsdc(row.pending)} USDC`}
          />
        ))}
      </dl>
    </CardShell>
  );
}

function UnknownCard() {
  return (
    <CardShell title="ASSISTANT">
      <p className="text-sm leading-6 text-text-dim">
        I can help with prices, depth, your holdings, yield, and buying.
      </p>
    </CardShell>
  );
}

function AssetAmbiguousCard({
  card,
}: {
  card: Extract<AssistantCard, { type: "asset_ambiguous" }>;
}) {
  return (
    <CardShell title="CLARIFY ASSET">
      <p className="text-sm leading-6 text-text-dim">
        Multiple assets match “{card.query}”. Choose an asset from the market first.
      </p>
      <ul className="mt-4 divide-y divide-border border border-border">
        {card.candidates.map((candidate) => (
          <li className="px-3 py-3" key={candidate.tokenId.toString()}>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-neon-dim">
              {candidate.ticker ? `${candidate.ticker} / ` : ""}TOKEN #{candidate.tokenId.toString()}
            </p>
            <p className="mt-1 text-sm text-text">{candidate.label}</p>
          </li>
        ))}
      </ul>
    </CardShell>
  );
}

function AssetNotFoundCard({ card }: { card: Extract<AssistantCard, { type: "asset_not_found" }> }) {
  return (
    <CardShell title="CLARIFY ASSET">
      <p className="text-sm leading-6 text-text-dim">Asset not found: {card.query}</p>
    </CardShell>
  );
}

export function AssistantCardView({ card }: { card: AssistantCard }) {
  switch (card.type) {
    case "price":
      return <PriceCard card={card} />;
    case "depth":
      return <DepthCard card={card} />;
    case "holdings":
      return <HoldingsCard card={card} />;
    case "yield":
      return <YieldCard card={card} />;
    case "buy":
      return <BuyConfirmCard {...card} />;
    case "asset_ambiguous":
      return <AssetAmbiguousCard card={card} />;
    case "asset_not_found":
      return <AssetNotFoundCard card={card} />;
    case "unknown":
      return <UnknownCard />;
  }
}

export function AssistantPanelView({
  cards,
  defaultAssetLabel,
  errorText,
  inputValue,
  isOpen,
  isSubmitting,
  onClose,
  onInputChange,
  onSubmit,
}: AssistantPanelViewProps) {
  if (!isOpen) {
    return null;
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  function changeInput(event: ChangeEvent<HTMLInputElement>) {
    onInputChange(event.target.value);
  }

  return (
    <aside className="fixed inset-x-3 bottom-3 z-50 border border-border bg-panel/95 shadow-2xl shadow-bg/60 backdrop-blur-xl sm:inset-x-auto sm:right-4 sm:w-[420px]">
      <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-neon-dim">NL ASSISTANT</p>
          <p className="mt-2 text-sm leading-6 text-text-dim">
            Ask about prices, depth, holdings, yield, or buying.
          </p>
          {defaultAssetLabel ? (
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
              CONTEXT {defaultAssetLabel}
            </p>
          ) : null}
        </div>
        <button
          aria-label="Close assistant"
          className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors duration-200 hover:text-text"
          onClick={onClose}
          type="button"
        >
          Close
        </button>
      </div>

      <div className="max-h-[min(70vh,620px)] space-y-3 overflow-y-auto px-4 py-4">
        {errorText ? (
          <div className="border border-down/70 bg-down/10 p-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-down">{errorText}</p>
          </div>
        ) : null}
        {cards.map((card, index) => (
          <AssistantCardView card={card} key={`${card.type}:${index}`} />
        ))}
      </div>

      <form className="border-t border-border p-4" onSubmit={submit}>
        <label className="block">
          <span className="sr-only">Assistant message</span>
          <input
            className="h-11 w-full border border-border bg-bg px-3 font-mono text-[11px] uppercase tracking-[0.14em] text-text outline-none transition-colors duration-200 placeholder:text-muted focus:border-neon"
            disabled={isSubmitting}
            onChange={changeInput}
            placeholder="BUY 5 TBILL"
            value={inputValue}
          />
        </label>
        <button
          className={[
            "mt-3 h-9 w-full border px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.2em]",
            "transition-colors duration-200",
            isSubmitting
              ? "cursor-not-allowed border-border bg-muted/30 text-text-dim"
              : "border-neon/50 bg-neon/10 text-neon hover:border-neon hover:bg-neon/15",
          ].join(" ")}
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Parsing" : "Send"}
        </button>
      </form>
    </aside>
  );
}
