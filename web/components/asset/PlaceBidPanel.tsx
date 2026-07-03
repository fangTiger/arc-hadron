"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAccount, useBalance, useConnect } from "wagmi";
import {
  formatListingPriceInput,
  labelClassName,
} from "@/components/trading/ListForSaleForm";
import { GlowButton } from "@/components/ui/GlowButton";
import { buildTxExplorerUrl, useToast } from "@/components/ui/TxToast";
import { ARC_CHAIN_ID } from "@/lib/chain";
import { validateBidPlacement } from "@/lib/bid";
import { formatUsdc, shortAddress } from "@/lib/format";
import { usePlaceBid } from "@/lib/hooks/usePlaceBid";
import { useNetworkGuard } from "@/lib/hooks/useNetworkGuard";
import type { AssetView } from "@/lib/mappers";

interface PlaceBidPanelProps {
  asset: AssetView;
  initialAmountInput?: string;
  initialPriceInput?: string;
}

function SecondaryButton({
  children,
  onClick,
}: {
  children: string;
  onClick: () => void;
}) {
  return (
    <button
      className="mt-4 h-10 w-full border border-border bg-bg/50 px-4 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-text-dim transition-colors duration-200 hover:border-border-glow hover:text-text"
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

function isBidBusy(status: string): boolean {
  return status === "signing" || status === "pending";
}

export function PlaceBidPanel({
  asset,
  initialAmountInput = "1",
  initialPriceInput,
}: PlaceBidPanelProps) {
  const defaultPriceInput = asset.offering ? formatListingPriceInput(asset.offering.pricePerShare) : "";
  const [amountInput, setAmountInput] = useState(initialAmountInput);
  const [priceInput, setPriceInput] = useState(initialPriceInput ?? defaultPriceInput);
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: isConnectPending } = useConnect();
  const { isCorrectChain, switchToArc } = useNetworkGuard();
  const { errorText, placeBid, reset, status, txHash } = usePlaceBid();
  const queryClient = useQueryClient();
  const { pushError, pushSuccess } = useToast();
  const lastNoticeKey = useRef<string | null>(null);
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
    if (!isConnected || !isCorrectChain || balanceQuery.isLoading) {
      return null;
    }

    return validateBidPlacement({
      amountInput,
      balance: balanceValue,
      priceInput,
    });
  }, [
    amountInput,
    balanceQuery.isLoading,
    balanceValue,
    isConnected,
    isCorrectChain,
    priceInput,
  ]);

  useEffect(() => {
    if (status === "success" && txHash) {
      const key = `bid-success:${txHash}`;

      if (lastNoticeKey.current !== key) {
        pushSuccess({ message: "Bid placed", txHash });
        lastNoticeKey.current = key;
        void Promise.all([
          queryClient.invalidateQueries(),
          refetchBalance(),
        ]).catch(() => undefined);
      }

      return;
    }

    if (status === "error" && errorText) {
      const key = `bid-error:${errorText}:${txHash ?? ""}`;

      if (lastNoticeKey.current !== key) {
        pushError(errorText);
        lastNoticeKey.current = key;
      }

      return;
    }

    lastNoticeKey.current = null;
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

  function resetBid() {
    lastNoticeKey.current = null;
    reset();
  }

  function submitBid() {
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

    placeBid(asset.tokenId, validation.amount, validation.pricePerShare, validation.totalValue);
  }

  const validationError = validation?.ok === false ? validation.errorText : null;
  const totalText = validation?.ok ? `${formatUsdc(validation.totalValue)} USDC` : "—";
  const balanceText = !isConnected
    ? "Not connected"
    : balanceQuery.isLoading
      ? "Loading..."
      : `${formatUsdc(balanceValue)} USDC`;
  let buttonLabel = "PLACE BID";
  let isButtonDisabled = false;

  if (!isConnected) {
    buttonLabel = isConnectPending ? "CONNECTING" : "CONNECT WALLET";
  } else if (!isCorrectChain) {
    buttonLabel = "Switch to ARC TESTNET";
  } else if (status === "signing") {
    buttonLabel = "Confirm in wallet...";
    isButtonDisabled = true;
  } else if (status === "pending") {
    buttonLabel = "Confirming on-chain...";
    isButtonDisabled = true;
  } else if (balanceQuery.isLoading) {
    buttonLabel = "Loading balance...";
    isButtonDisabled = true;
  } else if (validation?.ok !== true) {
    isButtonDisabled = true;
  }

  return (
    <section className="border border-border bg-panel p-6">
      <div className="border-b border-border pb-5">
        <p className={labelClassName()}>PLACE BID</p>
        <h2 className="mt-3 text-xl font-semibold text-text">Open a buy order</h2>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-neon-dim">
          {asset.meta.ticker} / TOKEN #{asset.tokenId.toString()}
        </p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelClassName()}>AMOUNT</span>
          <input
            className="mt-3 h-12 w-full border border-border bg-bg px-4 font-mono text-lg text-text outline-none transition-colors duration-200 placeholder:text-muted focus:border-neon disabled:cursor-not-allowed disabled:bg-muted/20 disabled:text-text-dim"
            disabled={isBidBusy(status)}
            inputMode="decimal"
            onChange={(event) => setAmountInput(event.target.value)}
            value={amountInput}
          />
        </label>
        <label className="block">
          <span className={labelClassName()}>BID PRICE (USDC)</span>
          <input
            className="mt-3 h-12 w-full border border-border bg-bg px-4 font-mono text-lg text-text outline-none transition-colors duration-200 placeholder:text-muted focus:border-neon disabled:cursor-not-allowed disabled:bg-muted/20 disabled:text-text-dim"
            disabled={isBidBusy(status)}
            inputMode="decimal"
            onChange={(event) => setPriceInput(event.target.value)}
            value={priceInput}
          />
        </label>
      </div>

      {validationError ? <p className="mt-3 text-sm leading-6 text-down">{validationError}</p> : null}

      <div className="mt-6 divide-y divide-border border-y border-border">
        <div className="flex items-center justify-between gap-4 py-4">
          <p className={labelClassName()}>ESCROW TOTAL</p>
          <p className="font-mono text-sm text-text">{totalText}</p>
        </div>
        <div className="flex items-center justify-between gap-4 py-4">
          <p className={labelClassName()}>BALANCE</p>
          <p className="font-mono text-sm text-text-dim">{balanceText}</p>
        </div>
      </div>

      <div className="mt-6">
        {status === "success" ? (
          <div className="border border-up/70 bg-up/10 p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-up">Bid placed</p>
            {txHash ? (
              <a
                className="mt-3 inline-flex font-mono text-[11px] uppercase tracking-[0.2em] text-neon-dim underline-offset-4 transition-colors duration-200 hover:text-neon hover:underline"
                href={buildTxExplorerUrl(explorerUrl, txHash)}
                rel="noreferrer"
                target="_blank"
              >
                {shortAddress(txHash)}
              </a>
            ) : null}
            <SecondaryButton onClick={resetBid}>Place another bid</SecondaryButton>
          </div>
        ) : status === "error" ? (
          <div className="border border-down/70 bg-down/10 p-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-down">
              {errorText ?? "Transaction failed, please retry"}
            </p>
            <SecondaryButton onClick={resetBid}>Retry</SecondaryButton>
          </div>
        ) : (
          <GlowButton
            className="w-full gap-2"
            disabled={isButtonDisabled}
            onClick={submitBid}
            size="md"
          >
            {status === "pending" ? (
              <span className="size-3 animate-spin rounded-full border border-current border-t-transparent motion-reduce:animate-none" />
            ) : null}
            <span>{buttonLabel}</span>
            {status === "pending" && txHash ? <span className="text-[10px]">{shortAddress(txHash)}</span> : null}
          </GlowButton>
        )}
      </div>
    </section>
  );
}
