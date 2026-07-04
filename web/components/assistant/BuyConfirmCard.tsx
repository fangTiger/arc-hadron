"use client";

import { formatShares, formatUsdc, shortAddress } from "@/lib/format";
import type { ResolveBuyResult } from "@/lib/ai/resolveBuy";
import { unitPriceToSharePrice } from "@/lib/shares";

export type AssistantBuyStatus = "idle" | "signing" | "pending" | "success" | "error";

export interface SubmitBuyConfirmationInput {
  isConnected: boolean;
  isCorrectChain: boolean;
  onBuyListing: (listingId: bigint, amount: bigint, totalValue: bigint) => void;
  onBuyPrimary: (offeringId: bigint, amount: bigint, totalValue: bigint) => void;
  onConnect: () => void;
  onSwitchNetwork: () => void;
  resolution: ResolveBuyResult;
  status: AssistantBuyStatus;
}

export interface BuyConfirmCardProps extends SubmitBuyConfirmationInput {
  assetLabel: string;
  errorText?: string;
  txHash?: `0x${string}`;
}

function isBuyReady(resolution: ResolveBuyResult): resolution is Extract<
  ResolveBuyResult,
  { kind: "fillable" | "partial" }
> {
  return resolution.kind === "fillable" || resolution.kind === "partial";
}

export function submitBuyConfirmation({
  isConnected,
  isCorrectChain,
  onBuyListing,
  onBuyPrimary,
  onConnect,
  onSwitchNetwork,
  resolution,
  status,
}: SubmitBuyConfirmationInput) {
  if (!isConnected) {
    onConnect();
    return;
  }

  if (!isCorrectChain) {
    onSwitchNetwork();
    return;
  }

  if (status !== "idle" || !isBuyReady(resolution)) {
    return;
  }

  if (resolution.source.type === "primary") {
    onBuyPrimary(resolution.source.offeringId, resolution.fillable, resolution.totalValue);
    return;
  }

  onBuyListing(resolution.source.listingId, resolution.fillable, resolution.totalValue);
}

function sourceLabel(resolution: Extract<ResolveBuyResult, { kind: "fillable" | "partial" }>) {
  return resolution.source.type === "primary"
    ? "PRIMARY"
    : `Listing #${resolution.source.listingId.toString()}`;
}

function buttonLabel({
  isConnected,
  isCorrectChain,
  resolution,
  status,
}: Pick<BuyConfirmCardProps, "isConnected" | "isCorrectChain" | "resolution" | "status">) {
  if (!isConnected) {
    return "Connect wallet";
  }

  if (!isCorrectChain) {
    return "Switch to ARC TESTNET";
  }

  if (status === "signing") {
    return "Confirm in wallet";
  }

  if (status === "pending") {
    return "Confirming on-chain";
  }

  if (status === "success") {
    return "Confirmed";
  }

  if (!isBuyReady(resolution)) {
    return "No source";
  }

  return "Confirm";
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-border py-3 first:border-t-0 first:pt-0 last:pb-0">
      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">{label}</dt>
      <dd className="font-mono text-sm text-text">{value}</dd>
    </div>
  );
}

export function BuyConfirmCard(props: BuyConfirmCardProps) {
  const {
    assetLabel,
    errorText,
    isConnected,
    isCorrectChain,
    onBuyListing,
    onBuyPrimary,
    onConnect,
    onSwitchNetwork,
    resolution,
    status,
    txHash,
  } = props;
  const canSubmit = status === "idle" && (isBuyReady(resolution) || !isConnected || !isCorrectChain);

  function confirm() {
    submitBuyConfirmation({
      isConnected,
      isCorrectChain,
      onBuyListing,
      onBuyPrimary,
      onConnect,
      onSwitchNetwork,
      resolution,
      status,
    });
  }

  if (!isBuyReady(resolution)) {
    return (
      <section className="border border-border bg-bg/60 p-4">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-neon-dim">
          BUY / {assetLabel}
        </h3>
        <p className="mt-4 text-sm leading-6 text-text-dim">
          No single source is available for this asset.
        </p>
      </section>
    );
  }

  return (
    <section className="border border-border bg-bg/60 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-neon-dim">
            BUY / {assetLabel}
          </h3>
          {resolution.kind === "partial" ? (
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-gold">
              MAX AVAILABLE {formatShares(resolution.fillable)}
            </p>
          ) : null}
        </div>
        <span className="border border-border bg-panel px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-text">
          {sourceLabel(resolution)}
        </span>
      </div>

      <dl className="mt-4">
        <StatRow
          label="UNIT PRICE"
          value={`${formatUsdc(unitPriceToSharePrice(resolution.pricePerShare))} USDC`}
        />
        <StatRow label="QUANTITY" value={formatShares(resolution.fillable)} />
        <StatRow label="TOTAL" value={`${formatUsdc(resolution.totalValue)} USDC`} />
      </dl>

      <p className="mt-4 border-t border-border pt-4 text-xs leading-5 text-text-dim">
        0.5% protocol fee is handled by the market contract.
      </p>

      {status === "success" && txHash ? (
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-up">
          Confirmed {shortAddress(txHash)}
        </p>
      ) : null}
      {status === "error" && errorText ? (
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-down">
          {errorText}
        </p>
      ) : null}

      <button
        className={[
          "mt-4 h-9 w-full border px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.2em]",
          "transition-colors duration-200",
          canSubmit
            ? "border-neon/50 bg-neon/10 text-neon hover:border-neon hover:bg-neon/15"
            : "cursor-not-allowed border-border bg-muted/30 text-text-dim",
        ].join(" ")}
        disabled={!canSubmit}
        onClick={confirm}
        type="button"
      >
        {buttonLabel({ isConnected, isCorrectChain, resolution, status })}
      </button>
    </section>
  );
}
