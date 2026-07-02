"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAccount, useBalance, useConnect } from "wagmi";
import { ARC_CHAIN_ID } from "@/lib/chain";
import { formatShares, formatUsdc, shortAddress } from "@/lib/format";
import { useBuyPrimary } from "@/lib/hooks/useBuyPrimary";
import { useListings } from "@/lib/hooks/useListings";
import { useNetworkGuard } from "@/lib/hooks/useNetworkGuard";
import type { AssetView } from "@/lib/mappers";
import { validatePurchase } from "@/lib/purchase";
import { GlowButton } from "@/components/ui/GlowButton";
import { buildTxExplorerUrl, useToast } from "@/components/ui/TxToast";

function SecondaryButton({
  children,
  onClick,
}: {
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      className="mt-4 h-10 w-full border border-border bg-bg/50 px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-text-dim transition-colors hover:border-border-glow hover:text-text"
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

interface RefreshPurchaseReadsInput {
  invalidateQueries: () => Promise<unknown>;
  refetchBalance: () => Promise<unknown>;
}

export async function refreshPurchaseReads({
  invalidateQueries,
  refetchBalance,
}: RefreshPurchaseReadsInput) {
  await Promise.all([refetchBalance(), invalidateQueries()]);
}

export function BuyPanel({ asset }: { asset: AssetView }) {
  const [amountInput, setAmountInput] = useState("1");
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: isConnectPending } = useConnect();
  const { isCorrectChain, switchToArc } = useNetworkGuard();
  const { buy, errorText, reset, status, txHash } = useBuyPrimary();
  const queryClient = useQueryClient();
  const { pushError, pushSuccess } = useToast();
  const lastRefreshKey = useRef<string | null>(null);
  const lastToastKey = useRef<string | null>(null);
  const offering = asset.offering;
  const { listings } = useListings(asset.tokenId);
  const bestAsk = listings[0] ?? null;
  const hasOffering = Boolean(offering && offering.active);
  const explorerUrl = process.env.NEXT_PUBLIC_ARC_EXPLORER_URL ?? "";

  const injectedConnector = useMemo(
    () => connectors.find((connector) => connector.type === "injected" || connector.id === "injected"),
    [connectors],
  );

  const balanceQuery = useBalance({
    address,
    chainId: ARC_CHAIN_ID,
    query: {
      enabled: Boolean(address),
    },
  });
  const { refetch: refetchBalance } = balanceQuery;

  const balanceValue = balanceQuery.data?.value ?? 0n;
  const validation = useMemo(() => {
    if (!offering || !hasOffering || !isConnected || !isCorrectChain || balanceQuery.isLoading) {
      return null;
    }

    return validatePurchase({
      amountInput,
      balance: balanceValue,
      pricePerShare: offering.pricePerShare,
      remaining: offering.remaining,
    });
  }, [
    amountInput,
    balanceQuery.isLoading,
    balanceValue,
    hasOffering,
    isConnected,
    isCorrectChain,
    offering,
  ]);

  useEffect(() => {
    if (status === "success" && txHash) {
      const key = `success:${txHash}`;

      if (lastRefreshKey.current !== key) {
        lastRefreshKey.current = key;
        void refreshPurchaseReads({
          invalidateQueries: () => queryClient.invalidateQueries(),
          refetchBalance,
        }).catch(() => undefined);
      }

      if (lastToastKey.current !== key) {
        pushSuccess({ message: "Purchase successful", txHash });
        lastToastKey.current = key;
      }

      return;
    }

    if (status === "error" && errorText) {
      const key = `error:${errorText}:${txHash ?? ""}`;

      if (lastToastKey.current !== key) {
        pushError(errorText);
        lastToastKey.current = key;
      }

      return;
    }

    lastToastKey.current = null;
  }, [errorText, pushError, pushSuccess, queryClient, refetchBalance, status, txHash]);

  function connectWallet() {
    if (!injectedConnector) {
      pushError("Install MetaMask or a compatible injected wallet.");
      return;
    }

    connect(
      { connector: injectedConnector },
      {
        onError: () => pushError("Install MetaMask or unlock your wallet."),
      },
    );
  }

  function resetPurchase() {
    lastToastKey.current = null;
    reset();
  }

  function submitBuy() {
    if (!offering || !hasOffering) {
      return;
    }

    if (!isConnected) {
      connectWallet();
      return;
    }

    if (!isCorrectChain) {
      switchToArc();
      return;
    }

    if (validation?.ok !== true || status !== "idle") {
      return;
    }

    buy(offering.id, validation.amount, validation.totalValue);
  }

  const totalText = validation?.ok ? `${formatUsdc(validation.totalValue)} USDC` : "—";
  const validationError = validation?.ok === false ? validation.errorText : null;
  const balanceText = !isConnected
    ? "Not connected"
    : balanceQuery.isLoading
      ? "Loading..."
      : `${formatUsdc(balanceValue)} USDC`;

  let buttonLabel = "BUY";
  let isButtonDisabled = false;

  if (!hasOffering) {
    buttonLabel = "No active offering";
    isButtonDisabled = true;
  } else if (!isConnected) {
    buttonLabel = isConnectPending ? "CONNECTING" : "CONNECT WALLET";
  } else if (!isCorrectChain) {
    buttonLabel = "Switch to ARC TESTNET";
  } else if (status === "signing") {
    buttonLabel = "Confirm in wallet…";
    isButtonDisabled = true;
  } else if (status === "pending") {
    buttonLabel = "Confirming on-chain…";
    isButtonDisabled = true;
  } else if (balanceQuery.isLoading) {
    buttonLabel = "Loading balance…";
    isButtonDisabled = true;
  } else if (validation?.ok !== true) {
    isButtonDisabled = true;
  }

  return (
    <aside className="border border-border bg-panel p-5">
      {bestAsk ? (
        <div className="mb-5 border-b border-border pb-5">
          <div className="flex items-center justify-between gap-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">BEST ASK</p>
            <p className="font-mono text-sm text-text">{formatUsdc(bestAsk.pricePerShare)} USDC</p>
          </div>
          <p className="mt-2 text-right font-mono text-[10px] uppercase tracking-[0.18em] text-text-dim">
            {formatShares(bestAsk.remaining)} SHARES
          </p>
        </div>
      ) : null}

      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">PRIMARY OFFERING</p>
        <p className="mt-4 font-mono text-4xl font-semibold leading-none text-text">
          {offering ? formatUsdc(offering.pricePerShare) : "—"}
        </p>
        <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.2em] text-text-dim">USDC / SHARE</p>
        <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.2em] text-neon-dim">
          {offering ? `REMAINING ${formatShares(offering.remaining)} SHARES` : "NO ACTIVE OFFERING"}
        </p>
      </div>

      <label className="mt-8 block">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">AMOUNT</span>
        <input
          className="mt-3 h-12 w-full border border-border bg-bg px-4 font-mono text-lg text-text outline-none transition-colors placeholder:text-muted focus:border-neon disabled:cursor-not-allowed disabled:bg-muted/20 disabled:text-text-dim"
          disabled={status === "signing" || status === "pending"}
          inputMode="numeric"
          onChange={(event) => setAmountInput(event.target.value)}
          pattern="[0-9]*"
          placeholder="1"
          value={amountInput}
        />
      </label>

      {validationError ? <p className="mt-3 text-sm leading-6 text-down">{validationError}</p> : null}

      <div className="mt-6 divide-y divide-border border-y border-border">
        <div className="flex items-center justify-between gap-4 py-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">TOTAL</p>
          <p className="font-mono text-sm text-text">{totalText}</p>
        </div>
        <div className="flex items-center justify-between gap-4 py-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">BALANCE</p>
          <p className="font-mono text-sm text-text-dim">{balanceText}</p>
        </div>
      </div>

      <div className="mt-6">
        {status === "success" ? (
          <div className="border border-up/70 bg-up/10 p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-up">Purchase successful</p>
            {txHash ? (
              <a
                className="mt-3 inline-flex font-mono text-[11px] uppercase tracking-[0.2em] text-neon-dim underline-offset-4 hover:text-neon hover:underline"
                href={buildTxExplorerUrl(explorerUrl, txHash)}
                rel="noreferrer"
                target="_blank"
              >
                {shortAddress(txHash)}
              </a>
            ) : null}
            <SecondaryButton onClick={resetPurchase}>Buy again</SecondaryButton>
          </div>
        ) : status === "error" ? (
          <div className="border border-down/70 bg-down/10 p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-down">
              {errorText ?? "Transaction failed, please retry"}
            </p>
            <SecondaryButton onClick={resetPurchase}>Retry</SecondaryButton>
          </div>
        ) : (
          <GlowButton
            className="w-full gap-2"
            disabled={isButtonDisabled}
            onClick={submitBuy}
            size="md"
          >
            {status === "pending" ? (
              <span className="size-3 animate-spin rounded-full border border-current border-t-transparent" />
            ) : null}
            <span>{buttonLabel}</span>
            {status === "pending" && txHash ? <span className="text-[10px]">{shortAddress(txHash)}</span> : null}
          </GlowButton>
        )}
      </div>
    </aside>
  );
}
