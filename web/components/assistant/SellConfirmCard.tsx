"use client";

import { formatShares, formatUsdc, shortAddress } from "@/lib/format";
import {
  sharePriceInputToUnitPrice,
  unitPriceToSharePrice,
  unitsFromSharesInput,
} from "@/lib/shares";
import type { ListForSaleStatus } from "@/lib/hooks/useListForSale";

export interface SubmitSellConfirmationInput {
  balance: bigint;
  isConnected: boolean;
  isCorrectChain: boolean;
  onConnect: () => void;
  onListForSale: (tokenId: bigint, amount: bigint, pricePerShare: bigint) => void;
  onSwitchNetwork: () => void;
  price?: number;
  quantity: number;
  status: ListForSaleStatus;
  tokenId: bigint;
}

export interface SellConfirmCardProps extends SubmitSellConfirmationInput {
  assetLabel: string;
  errorText?: string;
  txHash?: `0x${string}`;
}

function requestedAmount(quantity: number): bigint {
  return unitsFromSharesInput(quantity.toString());
}

function requestedPrice(price: number): bigint {
  return sharePriceInputToUnitPrice(price.toString());
}

function sellDraft({
  balance,
  price,
  quantity,
}: Pick<SubmitSellConfirmationInput, "balance" | "price" | "quantity">):
  | { kind: "ready"; amount: bigint; pricePerShare: bigint; totalValue: bigint }
  | { kind: "missing_price"; amount: bigint }
  | { kind: "insufficient"; amount: bigint; pricePerShare: bigint; totalValue: bigint }
  | { kind: "invalid" } {
  let amount: bigint;

  try {
    amount = requestedAmount(quantity);
  } catch {
    return { kind: "invalid" };
  }

  if (price === undefined) {
    return { kind: "missing_price", amount };
  }

  let pricePerShare: bigint;

  try {
    pricePerShare = requestedPrice(price);
  } catch {
    return { kind: "invalid" };
  }

  const totalValue = amount * pricePerShare;

  if (amount > balance) {
    return { kind: "insufficient", amount, pricePerShare, totalValue };
  }

  return { kind: "ready", amount, pricePerShare, totalValue };
}

export function submitSellConfirmation({
  balance,
  isConnected,
  isCorrectChain,
  onConnect,
  onListForSale,
  onSwitchNetwork,
  price,
  quantity,
  status,
  tokenId,
}: SubmitSellConfirmationInput) {
  if (!isConnected) {
    onConnect();
    return;
  }

  if (!isCorrectChain) {
    onSwitchNetwork();
    return;
  }

  const draft = sellDraft({ balance, price, quantity });

  if (status !== "idle" || draft.kind !== "ready") {
    return;
  }

  onListForSale(tokenId, draft.amount, draft.pricePerShare);
}

function buttonLabel({
  draftKind,
  isConnected,
  isCorrectChain,
  status,
}: {
  draftKind: ReturnType<typeof sellDraft>["kind"];
  isConnected: boolean;
  isCorrectChain: boolean;
  status: ListForSaleStatus;
}) {
  if (!isConnected) {
    return "Connect wallet";
  }

  if (!isCorrectChain) {
    return "Switch to ARC TESTNET";
  }

  if (draftKind === "missing_price") {
    return "Price required";
  }

  if (draftKind === "insufficient") {
    return "Insufficient holdings";
  }

  if (status === "checking") {
    return "Checking approval";
  }

  if (status === "approving") {
    return "Confirm approval";
  }

  if (status === "approve-pending") {
    return "Approval pending";
  }

  if (status === "signing") {
    return "Confirm listing";
  }

  if (status === "pending") {
    return "Listing on-chain";
  }

  if (status === "success") {
    return "Listed";
  }

  return "Confirm";
}

function stepText(status: ListForSaleStatus, step: "approval" | "listing") {
  if (step === "approval") {
    if (status === "approving" || status === "approve-pending") {
      return "IN PROGRESS";
    }

    if (status === "signing" || status === "pending" || status === "success") {
      return "COMPLETE";
    }

    return "READY";
  }

  if (status === "signing" || status === "pending") {
    return "IN PROGRESS";
  }

  if (status === "success") {
    return "COMPLETE";
  }

  return "NEXT";
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-border py-3 first:border-t-0 first:pt-0 last:pb-0">
      <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">{label}</dt>
      <dd className="font-mono text-sm text-text">{value}</dd>
    </div>
  );
}

function StepRow({
  call,
  label,
  state,
}: {
  call: string;
  label: string;
  state: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] gap-3 border-t border-border py-3 first:border-t-0">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text">{label}</p>
        <p className="mt-1 font-mono text-[10px] text-muted">{call}</p>
      </div>
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-neon-dim">{state}</p>
    </div>
  );
}

export function SellConfirmCard(props: SellConfirmCardProps) {
  const {
    assetLabel,
    balance,
    errorText,
    isConnected,
    isCorrectChain,
    onConnect,
    onListForSale,
    onSwitchNetwork,
    price,
    quantity,
    status,
    tokenId,
    txHash,
  } = props;
  const draft = sellDraft({ balance, price, quantity });
  const canSubmit =
    (draft.kind === "ready" || !isConnected || !isCorrectChain) &&
    (status === "idle" || status === "error");

  function confirm() {
    submitSellConfirmation({
      balance,
      isConnected,
      isCorrectChain,
      onConnect,
      onListForSale,
      onSwitchNetwork,
      price,
      quantity,
      status,
      tokenId,
    });
  }

  return (
    <section className="border border-border bg-bg/60 p-4">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-neon-dim">
        SELL / {assetLabel}
      </h3>

      {draft.kind === "missing_price" ? (
        <p className="mt-4 text-sm leading-6 text-text-dim">At what price per share?</p>
      ) : null}
      {draft.kind === "insufficient" ? (
        <p className="mt-4 text-sm leading-6 text-down">
          Insufficient holdings. You have {formatShares(balance)} shares available.
        </p>
      ) : null}
      {draft.kind === "invalid" ? (
        <p className="mt-4 text-sm leading-6 text-down">Enter a valid sell order.</p>
      ) : null}

      {draft.kind !== "invalid" ? (
        <dl className="mt-4">
          <StatRow label="QUANTITY" value={formatShares(draft.amount)} />
          {draft.kind === "missing_price" ? null : (
            <>
              <StatRow
                label="UNIT PRICE"
                value={`${formatUsdc(unitPriceToSharePrice(draft.pricePerShare))} USDC`}
              />
              <StatRow label="ESTIMATED PROCEEDS" value={`${formatUsdc(draft.totalValue)} USDC`} />
            </>
          )}
          <StatRow label="HOLDINGS" value={formatShares(balance)} />
        </dl>
      ) : null}

      <div className="mt-4 border-t border-border pt-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          TWO-STEP AUTHORIZATION
        </p>
        <div className="mt-2 divide-y divide-border border border-border px-3">
          <StepRow
            call="setApprovalForAll"
            label="APPROVAL"
            state={stepText(status, "approval")}
          />
          <StepRow call="list" label="LISTING" state={stepText(status, "listing")} />
        </div>
      </div>

      {status === "success" && txHash ? (
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-up">
          Listed {shortAddress(txHash)}
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
        {buttonLabel({ draftKind: draft.kind, isConnected, isCorrectChain, status })}
      </button>
    </section>
  );
}
