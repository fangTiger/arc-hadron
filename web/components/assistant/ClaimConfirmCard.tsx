"use client";

import { formatUsdc, shortAddress } from "@/lib/format";
import type { BuyPrimaryStatus } from "@/lib/hooks/useBuyPrimary";

export interface ClaimConfirmEntry {
  tokenId: bigint;
  assetLabel: string;
  amount: bigint;
}

export interface SubmitClaimConfirmationInput {
  entries: readonly ClaimConfirmEntry[];
  isConnected: boolean;
  isCorrectChain: boolean;
  mode: "single" | "batch";
  onClaim: (tokenId: bigint) => void;
  onClaimBatch: (tokenIds: bigint[]) => void;
  onConnect: () => void;
  onSwitchNetwork: () => void;
  status: BuyPrimaryStatus;
}

export interface ClaimConfirmCardProps extends SubmitClaimConfirmationInput {
  errorText?: string;
  txHash?: `0x${string}`;
}

function totalClaimable(entries: readonly ClaimConfirmEntry[]): bigint {
  return entries.reduce((sum, entry) => sum + entry.amount, 0n);
}

export function submitClaimConfirmation({
  entries,
  isConnected,
  isCorrectChain,
  mode,
  onClaim,
  onClaimBatch,
  onConnect,
  onSwitchNetwork,
  status,
}: SubmitClaimConfirmationInput) {
  if (!isConnected) {
    onConnect();
    return;
  }

  if (!isCorrectChain) {
    onSwitchNetwork();
    return;
  }

  if (entries.length === 0 || status !== "idle") {
    return;
  }

  if (mode === "single") {
    onClaim(entries[0].tokenId);
    return;
  }

  onClaimBatch(entries.map((entry) => entry.tokenId));
}

function buttonLabel({
  isConnected,
  isCorrectChain,
  status,
}: {
  isConnected: boolean;
  isCorrectChain: boolean;
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
    return "Claiming";
  }

  if (status === "success") {
    return "Claimed";
  }

  return "Confirm";
}

function title(mode: "single" | "batch", entries: readonly ClaimConfirmEntry[]) {
  if (entries.length === 0) {
    return "CLAIM";
  }

  return mode === "single" ? `CLAIM / ${entries[0].assetLabel}` : "CLAIM / ALL YIELD";
}

export function ClaimConfirmCard(props: ClaimConfirmCardProps) {
  const {
    entries,
    errorText,
    isConnected,
    isCorrectChain,
    mode,
    onClaim,
    onClaimBatch,
    onConnect,
    onSwitchNetwork,
    status,
    txHash,
  } = props;
  const total = totalClaimable(entries);
  const canSubmit =
    (entries.length > 0 || !isConnected || !isCorrectChain) &&
    (status === "idle" || status === "error");

  function confirm() {
    submitClaimConfirmation({
      entries,
      isConnected,
      isCorrectChain,
      mode,
      onClaim,
      onClaimBatch,
      onConnect,
      onSwitchNetwork,
      status,
    });
  }

  return (
    <section className="border border-border bg-bg/60 p-4">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-neon-dim">
        {title(mode, entries)}
      </h3>

      {entries.length === 0 ? (
        <p className="mt-4 text-sm leading-6 text-text-dim">Nothing to claim</p>
      ) : (
        <div className="mt-4">
          <div className="flex items-center justify-between gap-4 border-b border-border pb-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
              CLAIMABLE TOTAL
            </p>
            <p className="font-mono text-sm text-text">{formatUsdc(total)} USDC</p>
          </div>
          <dl>
            {entries.map((entry) => (
              <div
                className="flex items-center justify-between gap-4 border-t border-border py-3 first:border-t-0 last:pb-0"
                key={entry.tokenId.toString()}
              >
                <dt className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                  {entry.assetLabel}
                </dt>
                <dd className="font-mono text-sm text-text">{formatUsdc(entry.amount)} USDC</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {status === "success" && txHash ? (
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-up">
          Claimed {shortAddress(txHash)}
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
        {buttonLabel({ isConnected, isCorrectChain, status })}
      </button>
    </section>
  );
}
