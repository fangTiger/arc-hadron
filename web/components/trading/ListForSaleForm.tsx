"use client";

import { useMemo } from "react";
import { buildTxExplorerUrl } from "@/components/ui/TxToast";
import { formatUsdc, shortAddress } from "@/lib/format";
import type { ListForSaleStatus } from "@/lib/hooks/useListForSale";
import { validateListing } from "@/lib/listing";
import { sharesInputFromUnits, unitPriceToSharePrice } from "@/lib/shares";

const PROTOCOL_FEE_BPS = 50n;
const BPS_DENOMINATOR = 10_000n;
const USDC_SCALE = 10n ** 18n;

export type TxHash = `0x${string}`;

export function listingProceeds(totalValue: bigint): bigint {
  return (totalValue * (BPS_DENOMINATOR - PROTOCOL_FEE_BPS)) / BPS_DENOMINATOR;
}

export function formatListingPriceInput(value: bigint): string {
  const sharePrice = unitPriceToSharePrice(value);
  const whole = sharePrice / USDC_SCALE;
  const fractional = sharePrice % USDC_SCALE;

  if (fractional === 0n) {
    return whole.toString();
  }

  return `${whole.toString()}.${fractional.toString().padStart(18, "0").replace(/0+$/, "")}`;
}

export function defaultListingAmountInput(balance: bigint): string {
  return sharesInputFromUnits(balance);
}

export function labelClassName() {
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

export function isListForSaleBusy(status: ListForSaleStatus): boolean {
  return (
    status === "checking" ||
    status === "approving" ||
    status === "approve-pending" ||
    status === "signing" ||
    status === "pending"
  );
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
      className="mt-2 inline-flex font-mono text-[10px] uppercase tracking-[0.2em] text-neon-dim underline-offset-4 transition-colors duration-200 hover:text-neon hover:underline"
      href={buildTxExplorerUrl(explorerUrl, txHash)}
      rel="noreferrer"
      target="_blank"
    >
      {shortAddress(txHash)}
    </a>
  );
}

export function ListForSaleSteps({
  approveTxHash,
  explorerUrl,
  status,
  txHash,
}: {
  approveTxHash?: TxHash;
  explorerUrl: string;
  status: ListForSaleStatus;
  txHash?: TxHash;
}) {
  return (
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
  );
}

export interface ListForSaleFormProps {
  amountInput: string;
  approveTxHash?: TxHash;
  balance: bigint;
  errorText?: string;
  explorerUrl: string;
  maxAmountInput: string;
  onAmountChange: (value: string) => void;
  onMaxAmount: () => void;
  onPriceChange: (value: string) => void;
  onSubmit: (amount: bigint, pricePerShare: bigint) => void;
  priceInput: string;
  status: ListForSaleStatus;
  submitButtonLabel?: string;
  txHash?: TxHash;
}

export function ListForSaleForm({
  amountInput,
  approveTxHash,
  balance,
  errorText,
  explorerUrl,
  maxAmountInput,
  onAmountChange,
  onMaxAmount,
  onPriceChange,
  onSubmit,
  priceInput,
  status,
  submitButtonLabel,
  txHash,
}: ListForSaleFormProps) {
  const validation = useMemo(
    () =>
      validateListing({
        amountInput,
        balance,
        priceInput,
      }),
    [amountInput, balance, priceInput],
  );
  const totalValue = validation.ok ? validation.amount * validation.pricePerShare : null;
  const proceeds = totalValue === null ? null : listingProceeds(totalValue);
  const isBusy = isListForSaleBusy(status);
  const validationError = validation.ok ? null : validation.errorText;
  const submitDisabled = isBusy || status === "success" || !validation.ok;

  function submitListing() {
    if (!validation.ok || isBusy || status === "success") {
      return;
    }

    onSubmit(validation.amount, validation.pricePerShare);
  }

  return (
    <>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelClassName()}>AMOUNT</span>
          <div className="mt-3 flex">
            <input
              className="h-12 min-w-0 flex-1 border border-border bg-bg px-4 font-mono text-lg text-text outline-none transition-colors duration-200 placeholder:text-muted focus:border-neon disabled:cursor-not-allowed disabled:bg-muted/20 disabled:text-text-dim"
              disabled={isBusy}
              inputMode="decimal"
              onChange={(event) => onAmountChange(event.target.value)}
              value={amountInput}
            />
            <button
              aria-label={`Use maximum amount ${maxAmountInput}`}
              className="h-12 border border-l-0 border-border bg-bg/60 px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-neon-dim transition-colors duration-200 hover:border-neon hover:text-neon disabled:cursor-not-allowed disabled:bg-muted/20 disabled:text-muted"
              disabled={isBusy}
              onClick={onMaxAmount}
              type="button"
            >
              MAX
            </button>
          </div>
        </label>
        <label className="block">
          <span className={labelClassName()}>PRICE (USDC)</span>
          <input
            className="mt-3 h-12 w-full border border-border bg-bg px-4 font-mono text-lg text-text outline-none transition-colors duration-200 placeholder:text-muted focus:border-neon disabled:cursor-not-allowed disabled:bg-muted/20 disabled:text-text-dim"
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

      <ListForSaleSteps
        approveTxHash={approveTxHash}
        explorerUrl={explorerUrl}
        status={status}
        txHash={txHash}
      />

      {status === "error" ? (
        <p className="mt-4 border border-down/70 bg-down/10 p-3 text-sm leading-6 text-down">
          {errorText ?? "Transaction failed, please retry"}
        </p>
      ) : null}

      <button
        className="mt-6 flex h-11 w-full items-center justify-center gap-2 border border-neon bg-neon/15 px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-neon transition-colors duration-200 hover:bg-neon/25 disabled:cursor-not-allowed disabled:border-border disabled:bg-muted/20 disabled:text-muted"
        disabled={submitDisabled}
        onClick={submitListing}
        type="button"
      >
        {isBusy ? (
          <span className="size-3 animate-spin rounded-full border border-current border-t-transparent motion-reduce:animate-none" />
        ) : null}
        <span>{submitButtonLabel ?? statusLabel(status)}</span>
      </button>
    </>
  );
}
