"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAccount, useBalance, useConnect, useReadContract } from "wagmi";
import {
  defaultListingAmountInput,
  formatListingPriceInput,
  ListForSaleForm,
} from "@/components/trading/ListForSaleForm";
import { ARC_CHAIN_ID } from "@/lib/chain";
import { HADRON_ASSETS_ABI, HADRON_ASSETS_ADDRESS } from "@/lib/contracts";
import { formatShares, formatUsdc, shortAddress } from "@/lib/format";
import { useBuyPrimary } from "@/lib/hooks/useBuyPrimary";
import { useListForSale } from "@/lib/hooks/useListForSale";
import { useListings } from "@/lib/hooks/useListings";
import { useNetworkGuard } from "@/lib/hooks/useNetworkGuard";
import type { AssetView } from "@/lib/mappers";
import { validatePurchase } from "@/lib/purchase";
import { unitPriceToSharePrice } from "@/lib/shares";
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

type TradeMode = "buy" | "sell";

interface BuyPanelProps {
  asset: AssetView;
  initialMode?: TradeMode;
}

interface SellDraft {
  amountInput: string | null;
  priceInput: string | null;
  scopeKey: string;
}

function tradeTabClassName(isActive: boolean) {
  return [
    "h-9 flex-1 border px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.2em]",
    "transition-colors",
    isActive
      ? "border-neon bg-neon/10 text-neon"
      : "border-border bg-bg/50 text-text-dim hover:border-border-glow hover:text-text",
  ].join(" ");
}

function TradeTabs({
  activeMode,
  onChange,
}: {
  activeMode: TradeMode;
  onChange: (mode: TradeMode) => void;
}) {
  return (
    <div aria-label="Trade mode" className="mb-5 grid grid-cols-2 gap-2" role="tablist">
      {(["buy", "sell"] as const).map((mode) => (
        <button
          aria-selected={activeMode === mode}
          className={tradeTabClassName(activeMode === mode)}
          key={mode}
          onClick={() => onChange(mode)}
          role="tab"
          type="button"
        >
          {mode.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

export function BuyPanel({ asset, initialMode = "buy" }: BuyPanelProps) {
  const [activeMode, setActiveMode] = useState<TradeMode>(initialMode);
  const [amountInput, setAmountInput] = useState("1");
  const [sellDraft, setSellDraft] = useState<SellDraft>({
    amountInput: null,
    priceInput: null,
    scopeKey: "",
  });
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: isConnectPending } = useConnect();
  const { isCorrectChain, switchToArc } = useNetworkGuard();
  const { buy, errorText, reset, status, txHash } = useBuyPrimary();
  const {
    approveTxHash: listApproveTxHash,
    errorText: listErrorText,
    listForSale,
    status: listStatus,
    txHash: listTxHash,
  } = useListForSale();
  const queryClient = useQueryClient();
  const { pushError, pushSuccess } = useToast();
  const lastRefreshKey = useRef<string | null>(null);
  const lastToastKey = useRef<string | null>(null);
  const lastListingRefreshKey = useRef<string | null>(null);
  const lastListingToastKey = useRef<string | null>(null);
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
  const tokenBalanceQuery = useReadContract({
    address: HADRON_ASSETS_ADDRESS,
    abi: HADRON_ASSETS_ABI,
    chainId: ARC_CHAIN_ID,
    functionName: "balanceOf",
    args: address ? [address, asset.tokenId] : undefined,
    query: {
      enabled: Boolean(address),
      refetchInterval: 8000,
    },
  });
  const { refetch: refetchTokenBalance } = tokenBalanceQuery;

  const balanceValue = balanceQuery.data?.value ?? 0n;
  const tokenBalance = (tokenBalanceQuery.data ?? 0n) as bigint;
  const defaultSellAmountInput = defaultListingAmountInput(tokenBalance);
  const defaultSellPriceInput = useMemo(() => {
    const pricePerShare = bestAsk?.pricePerShare ?? offering?.pricePerShare;

    return pricePerShare === undefined ? "" : formatListingPriceInput(pricePerShare);
  }, [bestAsk?.pricePerShare, offering?.pricePerShare]);
  const sellScopeKey = `${address ?? "disconnected"}:${asset.tokenId.toString()}`;
  const scopedSellDraft = sellDraft.scopeKey === sellScopeKey ? sellDraft : null;
  const currentSellAmountInput = scopedSellDraft?.amountInput ?? defaultSellAmountInput;
  const currentSellPriceInput = scopedSellDraft?.priceInput ?? defaultSellPriceInput;
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

  useEffect(() => {
    if (listStatus === "success" && listTxHash) {
      const key = `list-success:${listTxHash}`;

      if (lastListingRefreshKey.current !== key) {
        lastListingRefreshKey.current = key;
        void Promise.all([
          queryClient.invalidateQueries(),
          refetchBalance(),
          refetchTokenBalance(),
        ]).catch(() => undefined);
      }

      if (lastListingToastKey.current !== key) {
        pushSuccess({ message: "Listing created", txHash: listTxHash });
        lastListingToastKey.current = key;
      }

      return;
    }

    if (listStatus === "error" && listErrorText) {
      const key = `list-error:${listErrorText}:${listTxHash ?? listApproveTxHash ?? ""}`;

      if (lastListingToastKey.current !== key) {
        pushError(listErrorText);
        lastListingToastKey.current = key;
      }

      return;
    }

    lastListingToastKey.current = null;
  }, [
    listApproveTxHash,
    listErrorText,
    listStatus,
    listTxHash,
    pushError,
    pushSuccess,
    queryClient,
    refetchBalance,
    refetchTokenBalance,
  ]);

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

  function submitSell(amount: bigint, pricePerShare: bigint) {
    if (!isConnected) {
      connectWallet();
      return;
    }

    if (!isCorrectChain) {
      switchToArc();
      return;
    }

    listForSale(asset.tokenId, amount, pricePerShare);
  }

  function updateSellAmountInput(value: string | null) {
    setSellDraft((previous) => ({
      amountInput: value,
      priceInput: previous.scopeKey === sellScopeKey ? previous.priceInput : null,
      scopeKey: sellScopeKey,
    }));
  }

  function updateSellPriceInput(value: string | null) {
    setSellDraft((previous) => ({
      amountInput: previous.scopeKey === sellScopeKey ? previous.amountInput : null,
      priceInput: value,
      scopeKey: sellScopeKey,
    }));
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
      <TradeTabs activeMode={activeMode} onChange={setActiveMode} />

      {activeMode === "buy" ? (
        <>
          {bestAsk ? (
            <div className="mb-5 border-b border-border pb-5">
              <div className="flex items-center justify-between gap-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">BEST ASK</p>
                <p className="font-mono text-sm text-text">
                  {formatUsdc(unitPriceToSharePrice(bestAsk.pricePerShare))} USDC
                </p>
              </div>
              <p className="mt-2 text-right font-mono text-[10px] uppercase tracking-[0.18em] text-text-dim">
                {formatShares(bestAsk.remaining)} SHARES
              </p>
            </div>
          ) : null}

          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">PRIMARY OFFERING</p>
            <p className="mt-4 font-mono text-4xl font-semibold leading-none text-text">
              {offering ? formatUsdc(unitPriceToSharePrice(offering.pricePerShare)) : "—"}
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
              inputMode="decimal"
              onChange={(event) => setAmountInput(event.target.value)}
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
        </>
      ) : (
        <div>
          <div className="border-b border-border pb-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">SECONDARY SELL</p>
            <p className="mt-3 font-mono text-sm font-semibold uppercase tracking-[0.18em] text-neon-dim">
              YOU HOLD {!isConnected ? "—" : tokenBalanceQuery.isLoading ? "..." : formatShares(tokenBalance)} SHARES
            </p>
          </div>

          {!isConnected ? (
            <div className="mt-6 border border-border bg-bg/50 p-4">
              <p className="text-sm leading-6 text-text-dim">
                Connect your wallet to list shares from your current holding.
              </p>
              <GlowButton
                className="mt-5 w-full"
                disabled={isConnectPending}
                onClick={connectWallet}
                size="md"
              >
                {isConnectPending ? "CONNECTING" : "CONNECT WALLET"}
              </GlowButton>
            </div>
          ) : tokenBalanceQuery.isLoading ? (
            <div className="mt-6 border border-border bg-bg/50 p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">Loading holding...</p>
            </div>
          ) : tokenBalance === 0n ? (
            <div className="mt-6 border border-border bg-bg/50 p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">NO POSITION</p>
              <p className="mt-3 text-sm leading-6 text-text-dim">You do not hold this asset</p>
            </div>
          ) : (
            <ListForSaleForm
              amountInput={currentSellAmountInput}
              approveTxHash={listApproveTxHash}
              balance={tokenBalance}
              errorText={listErrorText}
              explorerUrl={explorerUrl}
              maxAmountInput={defaultSellAmountInput}
              onAmountChange={(value) => updateSellAmountInput(value)}
              onMaxAmount={() => updateSellAmountInput(defaultSellAmountInput)}
              onPriceChange={(value) => updateSellPriceInput(value)}
              onSubmit={submitSell}
              priceInput={currentSellPriceInput}
              status={listStatus}
              submitButtonLabel={!isCorrectChain ? "Switch to ARC TESTNET" : undefined}
              txHash={listTxHash}
            />
          )}
        </div>
      )}
    </aside>
  );
}
