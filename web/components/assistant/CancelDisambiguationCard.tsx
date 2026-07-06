"use client";

import { formatShares, formatUsdc, shortAddress } from "@/lib/format";
import type { CancelableOrder } from "@/lib/ai/resolveCancelable";
import { unitPriceToSharePrice } from "@/lib/shares";
import type { BuyPrimaryStatus } from "@/lib/hooks/useBuyPrimary";

export interface SubmitCancelOrderInput {
  isConnected: boolean;
  isCorrectChain: boolean;
  onCancelBid: (bidId: bigint) => void;
  onCancelListing: (listingId: bigint) => void;
  onConnect: () => void;
  onSwitchNetwork: () => void;
  order?: CancelableOrder;
  status: BuyPrimaryStatus;
}

export interface CancelDisambiguationCardProps extends Omit<SubmitCancelOrderInput, "order"> {
  assetLabel: string;
  errorText?: string;
  orders: CancelableOrder[];
  txHash?: `0x${string}`;
}

export function submitCancelOrder({
  isConnected,
  isCorrectChain,
  onCancelBid,
  onCancelListing,
  onConnect,
  onSwitchNetwork,
  order,
  status,
}: SubmitCancelOrderInput) {
  if (!isConnected) {
    onConnect();
    return;
  }

  if (!isCorrectChain) {
    onSwitchNetwork();
    return;
  }

  if (!order || status !== "idle") {
    return;
  }

  if (order.side === "listing") {
    onCancelListing(order.id);
    return;
  }

  onCancelBid(order.id);
}

function buttonLabel({
  isConnected,
  isCorrectChain,
  side,
  status,
}: {
  isConnected: boolean;
  isCorrectChain: boolean;
  side?: CancelableOrder["side"];
  status: BuyPrimaryStatus;
}) {
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
    return "Cancelling";
  }

  if (status === "success") {
    return "Cancelled";
  }

  return side === "listing" ? "Cancel listing" : "Cancel bid";
}

function orderTitle(order: CancelableOrder): string {
  return order.side === "listing"
    ? `LISTING #${order.id.toString()}`
    : `BID #${order.id.toString()}`;
}

export function CancelDisambiguationCard(props: CancelDisambiguationCardProps) {
  const {
    assetLabel,
    errorText,
    isConnected,
    isCorrectChain,
    onCancelBid,
    onCancelListing,
    onConnect,
    onSwitchNetwork,
    orders,
    status,
    txHash,
  } = props;
  const canSubmit = status === "idle" || status === "error" || !isConnected || !isCorrectChain;

  function submit(order?: CancelableOrder) {
    submitCancelOrder({
      isConnected,
      isCorrectChain,
      onCancelBid,
      onCancelListing,
      onConnect,
      onSwitchNetwork,
      order,
      status,
    });
  }

  return (
    <section className="border border-border bg-bg/60 p-4">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-neon-dim">
        CANCEL / {assetLabel}
      </h3>

      {!isConnected || !isCorrectChain ? (
        <div className="mt-4">
          <p className="text-sm leading-6 text-text-dim">
            {isConnected
              ? "Switch to ARC TESTNET to cancel orders"
              : "Connect wallet to cancel orders"}
          </p>
          <button
            className="mt-4 h-9 w-full border border-neon/50 bg-neon/10 px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-neon transition-colors duration-200 hover:border-neon hover:bg-neon/15"
            onClick={() => submit()}
            type="button"
          >
            {buttonLabel({ isConnected, isCorrectChain, status })}
          </button>
        </div>
      ) : orders.length === 0 ? (
        <p className="mt-4 text-sm leading-6 text-text-dim">
          No open orders to cancel for {assetLabel}
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border border border-border">
          {orders.map((order) => (
            <li className="grid gap-3 px-3 py-3" key={`${order.side}:${order.id.toString()}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text">
                    {orderTitle(order)}
                  </p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                    {formatUsdc(unitPriceToSharePrice(order.price))} USDC / {formatShares(order.size)}
                  </p>
                </div>
                <button
                  className={[
                    "h-8 border px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.18em]",
                    "transition-colors duration-200",
                    canSubmit
                      ? "border-neon/50 bg-neon/10 text-neon hover:border-neon hover:bg-neon/15"
                      : "cursor-not-allowed border-border bg-muted/30 text-text-dim",
                  ].join(" ")}
                  disabled={!canSubmit}
                  onClick={() => submit(order)}
                  type="button"
                >
                  {buttonLabel({ isConnected, isCorrectChain, side: order.side, status })}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {status === "success" && txHash ? (
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-up">
          Cancelled {shortAddress(txHash)}
        </p>
      ) : null}
      {status === "error" && errorText ? (
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-down">
          {errorText}
        </p>
      ) : null}
    </section>
  );
}
