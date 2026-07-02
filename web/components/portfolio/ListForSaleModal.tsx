"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { buildTxExplorerUrl, useToast } from "@/components/ui/TxToast";
import { formatShares, formatUsdc, shortAddress } from "@/lib/format";
import { useListForSale, type ListForSaleStatus } from "@/lib/hooks/useListForSale";
import { validateListing } from "@/lib/listing";
import type { Holding } from "@/lib/mappers";

const PROTOCOL_FEE_BPS = 50n;
const BPS_DENOMINATOR = 10_000n;
const USDC_SCALE = 10n ** 18n;

export function listingProceeds(totalValue: bigint): bigint {
  return (totalValue * (BPS_DENOMINATOR - PROTOCOL_FEE_BPS)) / BPS_DENOMINATOR;
}

export function formatListingPriceInput(value: bigint): string {
  const whole = value / USDC_SCALE;
  const fractional = value % USDC_SCALE;

  if (fractional === 0n) {
    return whole.toString();
  }

  return `${whole.toString()}.${fractional.toString().padStart(18, "0").replace(/0+$/, "")}`;
}

type TxHash = `0x${string}`;

export interface ListForSaleModalViewProps {
  amountInput: string;
  approveTxHash?: TxHash;
  errorText?: string;
  explorerUrl: string;
  holding: Holding;
  onAmountChange: (value: string) => void;
  onClose: () => void;
  onPriceChange?: (value: string) => void;
  onSubmit: (amount: bigint, pricePerShare: bigint) => void;
  priceInput: string;
  status: ListForSaleStatus;
  txHash?: TxHash;
}

function labelClassName() {
  return "font-mono text-[10px] uppercase tracking-[0.2em] text-muted";
}

function stepTone(status: ListForSaleStatus, step: "approve" | "list") {
  if (step === "approve") {
    if (status === "checking" || status === "approving" || status === "approve-pending") {
      return "border-neon text-neon";
    }

    if (status === "signing" || status === "pending" || status === "success") {
      return "border-up/70 text-up";
    }
  }

  if (status === "signing" || status === "pending" || status === "success") {
    return status === "success" ? "border-up/70 text-up" : "border-neon text-neon";
  }

  return "border-border text-text-dim";
}

function statusLabel(status: ListForSaleStatus) {
  switch (status) {
    case "checking":
      return "Checking approval...";
    case "approving":
      return "Confirm approval in wallet...";
    case "approve-pending":
      return "Approving on-chain...";
    case "signing":
      return "Confirm listing in wallet...";
    case "pending":
      return "Listing on-chain...";
    case "success":
      return "Listed";
    case "error":
      return "Retry listing";
    case "idle":
    default:
      return "List shares";
  }
}

function TransactionLink({
  explorerUrl,
  txHash,
}: {
  explorerUrl: string;
  txHash?: TxHash;
}) {
  if (!txHash) {
    return null;
  }

  return (
    <a
      className="mt-2 inline-flex font-mono text-[10px] uppercase tracking-[0.2em] text-neon-dim underline-offset-4 hover:text-neon hover:underline"
      href={buildTxExplorerUrl(explorerUrl, txHash)}
      rel="noreferrer"
      target="_blank"
    >
      {shortAddress(txHash)}
    </a>
  );
}

export function ListForSaleModalView({
  amountInput,
  approveTxHash,
  errorText,
  explorerUrl,
  holding,
  onAmountChange,
  onClose,
  onPriceChange = () => undefined,
  onSubmit,
  priceInput,
  status,
  txHash,
}: ListForSaleModalViewProps) {
  const validation = useMemo(
    () =>
      validateListing({
        amountInput,
        balance: holding.balance,
        priceInput,
      }),
    [amountInput, holding.balance, priceInput],
  );
  const totalValue = validation.ok ? validation.amount * validation.pricePerShare : null;
  const proceeds = totalValue === null ? null : listingProceeds(totalValue);
  const isBusy =
    status === "checking" ||
    status === "approving" ||
    status === "approve-pending" ||
    status === "signing" ||
    status === "pending";
  const validationError = validation.ok ? null : validation.errorText;
  const submitDisabled = isBusy || !validation.ok;

  function submitListing() {
    if (!validation.ok || isBusy) {
      return;
    }

    onSubmit(validation.amount, validation.pricePerShare);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-bg/80 px-4 py-8 backdrop-blur-sm">
      <section
        aria-modal="true"
        className="w-full max-w-xl border border-border bg-panel p-5 shadow-2xl shadow-bg/60"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border pb-5">
          <div>
            <p className={labelClassName()}>LIST FOR SALE</p>
            <h2 className="mt-3 text-2xl font-semibold text-text">
              {holding.asset.meta.displayName}
            </h2>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-neon-dim">
              BALANCE {formatShares(holding.balance)} {holding.asset.meta.ticker}
            </p>
          </div>
          <button
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors hover:text-text"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className={labelClassName()}>AMOUNT</span>
            <input
              className="mt-3 h-12 w-full border border-border bg-bg px-4 font-mono text-lg text-text outline-none transition-colors placeholder:text-muted focus:border-neon disabled:cursor-not-allowed disabled:bg-muted/20 disabled:text-text-dim"
              disabled={isBusy}
              inputMode="numeric"
              onChange={(event) => onAmountChange(event.target.value)}
              pattern="[0-9]*"
              value={amountInput}
            />
          </label>
          <label className="block">
            <span className={labelClassName()}>PRICE (USDC)</span>
            <input
              className="mt-3 h-12 w-full border border-border bg-bg px-4 font-mono text-lg text-text outline-none transition-colors placeholder:text-muted focus:border-neon disabled:cursor-not-allowed disabled:bg-muted/20 disabled:text-text-dim"
              disabled={isBusy}
              inputMode="decimal"
              onChange={(event) => onPriceChange(event.target.value)}
              value={priceInput}
            />
          </label>
        </div>

        {validationError ? <p className="mt-3 text-sm leading-6 text-down">{validationError}</p> : null}

        <div className="mt-6 divide-y divide-border border-y border-border">
          <div className="flex items-center justify-between gap-4 py-4">
            <p className={labelClassName()}>GROSS TOTAL</p>
            <p className="font-mono text-sm text-text">
              {totalValue === null ? "—" : `${formatUsdc(totalValue)} USDC`}
            </p>
          </div>
          <div className="flex items-center justify-between gap-4 py-4">
            <div>
              <p className={labelClassName()}>EST. PROCEEDS</p>
              <p className="mt-1 text-xs text-text-dim">0.5% protocol fee</p>
            </div>
            <p className="font-mono text-sm text-up">
              {proceeds === null ? "—" : `${formatUsdc(proceeds)} USDC`}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className={`border p-4 ${stepTone(status, "approve")}`}>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em]">Approve</p>
            <TransactionLink explorerUrl={explorerUrl} txHash={approveTxHash} />
          </div>
          <div className={`border p-4 ${stepTone(status, "list")}`}>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em]">List</p>
            <TransactionLink explorerUrl={explorerUrl} txHash={txHash} />
          </div>
        </div>

        {status === "error" ? (
          <p className="mt-4 border border-down/70 bg-down/10 p-3 text-sm leading-6 text-down">
            {errorText ?? "Transaction failed, please retry"}
          </p>
        ) : null}

        <button
          className="mt-6 flex h-11 w-full items-center justify-center gap-2 border border-neon bg-neon/15 px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-neon transition-colors hover:bg-neon/25 disabled:cursor-not-allowed disabled:border-border disabled:bg-muted/20 disabled:text-muted"
          disabled={submitDisabled}
          onClick={submitListing}
          type="button"
        >
          {isBusy ? (
            <span className="size-3 animate-spin rounded-full border border-current border-t-transparent" />
          ) : null}
          <span>{statusLabel(status)}</span>
        </button>
      </section>
    </div>
  );
}

export function ListForSaleModal({
  holding,
  onClose,
}: {
  holding: Holding;
  onClose: () => void;
}) {
  const [amountInput, setAmountInput] = useState("1");
  const [priceInput, setPriceInput] = useState(
    holding.asset.offering ? formatListingPriceInput(holding.asset.offering.pricePerShare) : "",
  );
  const { approveTxHash, errorText, listForSale, reset, status, txHash } = useListForSale();
  const { pushError, pushSuccess } = useToast();
  const queryClient = useQueryClient();
  const lastNoticeKey = useRef<string | null>(null);
  const explorerUrl = process.env.NEXT_PUBLIC_ARC_EXPLORER_URL ?? "";

  useEffect(() => {
    if (status === "success" && txHash) {
      const key = `success:${txHash}`;

      if (lastNoticeKey.current !== key) {
        pushSuccess({ message: "Listing created", txHash });
        lastNoticeKey.current = key;
        void queryClient.invalidateQueries().catch(() => undefined);
        reset();
        onClose();
      }

      return;
    }

    if (status === "error" && errorText) {
      const key = `error:${errorText}:${txHash ?? approveTxHash ?? ""}`;

      if (lastNoticeKey.current !== key) {
        pushError(errorText);
        lastNoticeKey.current = key;
      }

      return;
    }

    lastNoticeKey.current = null;
  }, [
    approveTxHash,
    errorText,
    onClose,
    pushError,
    pushSuccess,
    queryClient,
    reset,
    status,
    txHash,
  ]);

  function closeModal() {
    reset();
    onClose();
  }

  return (
    <ListForSaleModalView
      amountInput={amountInput}
      approveTxHash={approveTxHash}
      errorText={errorText}
      explorerUrl={explorerUrl}
      holding={holding}
      onAmountChange={setAmountInput}
      onClose={closeModal}
      onPriceChange={setPriceInput}
      onSubmit={(amount, pricePerShare) => {
        listForSale(holding.asset.tokenId, amount, pricePerShare);
      }}
      priceInput={priceInput}
      status={status}
      txHash={txHash}
    />
  );
}
