"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAccount, useBalance, useConnect } from "wagmi";
import { ARC_CHAIN_ID } from "@/lib/chain";
import { formatShares, formatUsdc, shortAddress } from "@/lib/format";
import { useBuyListing } from "@/lib/hooks/useBuyListing";
import { useCancelListing } from "@/lib/hooks/useCancelListing";
import { useListings, type ListingView } from "@/lib/hooks/useListings";
import { useNetworkGuard } from "@/lib/hooks/useNetworkGuard";
import { validateListingPurchase } from "@/lib/listing";
import { stopRowNavigation } from "@/lib/rowNavigation";
import { sharesInputFromUnits, unitPriceToSharePrice } from "@/lib/shares";
import type { BuyPrimaryStatus } from "@/lib/hooks/useBuyPrimary";
import { GlowButton } from "@/components/ui/GlowButton";
import { buildTxExplorerUrl, useToast } from "@/components/ui/TxToast";
import { refreshPurchaseReads } from "./BuyPanel";

interface ListingsTableProps {
  initialAmountInput?: string;
  initialExpandedListingId?: bigint;
  tokenId: bigint;
}

function SecondaryButton({
  children,
  disabled,
  onClick,
}: {
  children: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="h-8 border border-border bg-bg/50 px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-text-dim transition-colors duration-200 hover:border-border-glow hover:text-text disabled:cursor-not-allowed disabled:bg-muted/20 disabled:text-muted"
      disabled={disabled}
      onClick={(event) => {
        stopRowNavigation(event);
        onClick();
      }}
      type="button"
    >
      {children}
    </button>
  );
}

function compareListings(a: ListingView, b: ListingView): number {
  if (a.pricePerShare !== b.pricePerShare) {
    return a.pricePerShare < b.pricePerShare ? -1 : 1;
  }

  if (a.id === b.id) {
    return 0;
  }

  return a.id < b.id ? -1 : 1;
}

function isBusy(status: BuyPrimaryStatus): boolean {
  return status === "signing" || status === "pending";
}

function actionLabel({
  defaultLabel,
  isBalanceLoading,
  isConnected,
  isCorrectChain,
  isConnectPending,
  isValid,
  status,
}: {
  defaultLabel: string;
  isBalanceLoading?: boolean;
  isConnected: boolean;
  isCorrectChain: boolean;
  isConnectPending: boolean;
  isValid: boolean;
  status: BuyPrimaryStatus;
}) {
  if (!isConnected) {
    return isConnectPending ? "CONNECTING" : "CONNECT WALLET";
  }

  if (!isCorrectChain) {
    return "Switch to ARC TESTNET";
  }

  if (status === "signing") {
    return "Confirm in wallet…";
  }

  if (status === "pending") {
    return "Confirming on-chain…";
  }

  if (isBalanceLoading) {
    return "Loading balance…";
  }

  if (!isValid) {
    return defaultLabel;
  }

  return defaultLabel;
}

function TransactionStatusPanel({
  errorText,
  onReset,
  status,
  successLabel,
  txHash,
}: {
  errorText?: string;
  onReset: () => void;
  status: BuyPrimaryStatus;
  successLabel: string;
  txHash?: `0x${string}`;
}) {
  const explorerUrl = process.env.NEXT_PUBLIC_ARC_EXPLORER_URL ?? "";

  if (status === "success") {
    return (
      <div className="border border-up/70 bg-up/10 p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-up">{successLabel}</p>
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
        <div className="mt-4">
          <SecondaryButton onClick={onReset}>Buy again</SecondaryButton>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="border border-down/70 bg-down/10 p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-down">
          {errorText ?? "Transaction failed, please retry"}
        </p>
        <div className="mt-4">
          <SecondaryButton onClick={onReset}>Retry</SecondaryButton>
        </div>
      </div>
    );
  }

  return null;
}

export function ListingsTable({
  initialAmountInput,
  initialExpandedListingId,
  tokenId,
}: ListingsTableProps) {
  const [expandedListingId, setExpandedListingId] = useState<bigint | null>(
    initialExpandedListingId ?? null,
  );
  const [amountInput, setAmountInput] = useState<string | null>(initialAmountInput ?? null);
  const [confirmCancelId, setConfirmCancelId] = useState<bigint | null>(null);
  const [activeCancelId, setActiveCancelId] = useState<bigint | null>(null);
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: isConnectPending } = useConnect();
  const { isCorrectChain, switchToArc } = useNetworkGuard();
  const { listings, isLoading } = useListings(tokenId);
  const {
    buy,
    errorText: buyErrorText,
    reset: resetBuy,
    status: buyStatus,
    txHash: buyTxHash,
  } = useBuyListing();
  const {
    cancel,
    errorText: cancelErrorText,
    reset: resetCancel,
    status: cancelStatus,
    txHash: cancelTxHash,
  } = useCancelListing();
  const queryClient = useQueryClient();
  const { pushError, pushSuccess } = useToast();
  const lastBuyToastKey = useRef<string | null>(null);
  const lastCancelToastKey = useRef<string | null>(null);
  const lastBuyRefreshKey = useRef<string | null>(null);
  const lastCancelRefreshKey = useRef<string | null>(null);

  const sortedListings = useMemo(() => [...listings].sort(compareListings), [listings]);
  const expandedListing = sortedListings.find((listing) => listing.id === expandedListingId) ?? null;
  const currentAmountInput = expandedListing
    ? (amountInput ?? sharesInputFromUnits(expandedListing.remaining))
    : "";
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
    if (!expandedListing || !isConnected || !isCorrectChain || balanceQuery.isLoading) {
      return null;
    }

    return validateListingPurchase({
      amountInput: currentAmountInput,
      balance: balanceValue,
      pricePerShare: expandedListing.pricePerShare,
      remaining: expandedListing.remaining,
    });
  }, [
    balanceQuery.isLoading,
    balanceValue,
    currentAmountInput,
    expandedListing,
    isConnected,
    isCorrectChain,
  ]);

  useEffect(() => {
    if (buyStatus === "success" && buyTxHash) {
      const key = `buy-success:${buyTxHash}`;

      if (lastBuyRefreshKey.current !== key) {
        lastBuyRefreshKey.current = key;
        void refreshPurchaseReads({
          invalidateQueries: () => queryClient.invalidateQueries(),
          refetchBalance,
        }).catch(() => undefined);
      }

      if (lastBuyToastKey.current !== key) {
        pushSuccess({ message: "Purchase successful", txHash: buyTxHash });
        lastBuyToastKey.current = key;
      }

      return;
    }

    if (buyStatus === "error" && buyErrorText) {
      const key = `buy-error:${buyErrorText}:${buyTxHash ?? ""}`;

      if (lastBuyToastKey.current !== key) {
        pushError(buyErrorText);
        lastBuyToastKey.current = key;
      }

      return;
    }

    lastBuyToastKey.current = null;
  }, [buyErrorText, buyStatus, buyTxHash, pushError, pushSuccess, queryClient, refetchBalance]);

  useEffect(() => {
    if (cancelStatus === "success" && cancelTxHash) {
      const key = `cancel-success:${cancelTxHash}`;

      if (lastCancelRefreshKey.current !== key) {
        lastCancelRefreshKey.current = key;
        void refreshPurchaseReads({
          invalidateQueries: () => queryClient.invalidateQueries(),
          refetchBalance,
        }).catch(() => undefined);
      }

      if (lastCancelToastKey.current !== key) {
        pushSuccess({ message: "Listing cancelled", txHash: cancelTxHash });
        lastCancelToastKey.current = key;
      }

      return;
    }

    if (cancelStatus === "error" && cancelErrorText) {
      const key = `cancel-error:${cancelErrorText}:${cancelTxHash ?? ""}`;

      if (lastCancelToastKey.current !== key) {
        pushError(cancelErrorText);
        lastCancelToastKey.current = key;
      }

      return;
    }

    lastCancelToastKey.current = null;
  }, [
    cancelErrorText,
    cancelStatus,
    cancelTxHash,
    pushError,
    pushSuccess,
    queryClient,
    refetchBalance,
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

  function openBuy(listing: ListingView) {
    setExpandedListingId((current) => (current === listing.id ? null : listing.id));
    setAmountInput(sharesInputFromUnits(listing.remaining));
    setConfirmCancelId(null);
    resetBuy();
  }

  function handleListingRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, listing: ListingView) {
    if (listing.isMine || (event.key !== "Enter" && event.key !== " ")) {
      return;
    }

    event.preventDefault();
    openBuy(listing);
  }

  function submitBuy() {
    if (!expandedListing) {
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

    if (validation?.ok !== true || buyStatus !== "idle") {
      return;
    }

    buy(expandedListing.id, validation.amount, validation.totalValue);
  }

  function requestCancel(listingId: bigint) {
    if (confirmCancelId !== listingId) {
      setConfirmCancelId(listingId);
      setExpandedListingId(null);
      return;
    }

    setActiveCancelId(listingId);
    cancel(listingId);
  }

  function resetPurchase() {
    lastBuyToastKey.current = null;
    resetBuy();
  }

  const validationError = validation?.ok === false ? validation.errorText : null;
  const totalText = validation?.ok ? `${formatUsdc(validation.totalValue)} USDC` : "—";
  const balanceText = !isConnected
    ? "Not connected"
    : balanceQuery.isLoading
      ? "Loading..."
      : `${formatUsdc(balanceValue)} USDC`;
  const confirmLabel = actionLabel({
    defaultLabel: "CONFIRM BUY",
    isBalanceLoading: balanceQuery.isLoading,
    isConnected,
    isConnectPending,
    isCorrectChain,
    isValid: validation?.ok === true,
    status: buyStatus,
  });
  const isConfirmDisabled =
    isBusy(buyStatus) ||
    balanceQuery.isLoading ||
    (isConnected && isCorrectChain && validation?.ok !== true);
  return (
    <section className="border border-border bg-panel p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-neon-dim">SECONDARY MARKET</p>
          <h2 className="mt-2 font-mono text-[11px] uppercase tracking-[0.2em] text-text">SELL ORDERS</h2>
        </div>
        <span className="w-fit border border-border bg-bg/60 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          {isLoading ? "LOADING" : `${sortedListings.length} ACTIVE`}
        </span>
      </div>

      <div className="mt-6 overflow-x-auto border border-border">
        <table className="w-full min-w-[620px] border-collapse">
          <thead className="bg-bg/60">
            <tr className="border-b border-border">
              {["PRICE", "AMOUNT", "SELLER", "ACTION"].map((label) => (
                <th
                  className="px-4 py-3 text-left font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted"
                  key={label}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sortedListings.map((listing) => {
              const isExpanded = expandedListingId === listing.id;
              const isCancelTarget = activeCancelId === listing.id;
              const isCancelBusy = isCancelTarget && isBusy(cancelStatus);

              return (
                <Fragment key={listing.id.toString()}>
                  <tr
                    aria-label={listing.isMine ? undefined : `Open buy form for listing ${listing.id.toString()}`}
                    className={[
                      isExpanded ? "bg-bg/40" : "bg-panel",
                      "transition-colors duration-200 hover:bg-border/20",
                      listing.isMine ? "" : "cursor-pointer",
                    ].join(" ")}
                    onClick={() => {
                      if (!listing.isMine) {
                        openBuy(listing);
                      }
                    }}
                    onKeyDown={(event) => handleListingRowKeyDown(event, listing)}
                    role={listing.isMine ? undefined : "button"}
                    tabIndex={listing.isMine ? undefined : 0}
                  >
                    <td className="px-4 py-4 align-middle">
                      <p className="font-mono text-sm text-text">
                        {formatUsdc(unitPriceToSharePrice(listing.pricePerShare))}
                      </p>
                      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                        USDC / SHARE
                      </p>
                    </td>
                    <td className="px-4 py-4 align-middle font-mono text-sm text-text">
                      {formatShares(listing.remaining)}
                    </td>
                    <td className="px-4 py-4 align-middle">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-text-dim">{shortAddress(listing.seller)}</span>
                        {listing.isMine ? (
                          <span className="border border-neon/40 bg-neon/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-neon">
                            You
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-middle">
                      {listing.isMine ? (
                        <div className="flex flex-wrap items-center gap-2">
                          {confirmCancelId === listing.id ? (
                            <>
                              <SecondaryButton
                                disabled={isCancelBusy || (isCancelTarget && cancelStatus === "success")}
                                onClick={() => requestCancel(listing.id)}
                              >
                                {isCancelBusy
                                  ? "Confirming..."
                                  : isCancelTarget && cancelStatus === "success"
                                    ? "Cancelled"
                                    : "Confirm cancel"}
                              </SecondaryButton>
                              <SecondaryButton
                                disabled={isCancelBusy}
                                onClick={() => {
                                  setConfirmCancelId(null);
                                  resetCancel();
                                }}
                              >
                                Keep
                              </SecondaryButton>
                            </>
                          ) : (
                            <SecondaryButton
                              disabled={isCancelBusy}
                              onClick={() => requestCancel(listing.id)}
                            >
                              Cancel
                            </SecondaryButton>
                          )}
                        </div>
                      ) : (
                        <GlowButton
                          disabled={isBusy(buyStatus)}
                          onClick={(event) => {
                            stopRowNavigation(event);
                            openBuy(listing);
                          }}
                          size="sm"
                        >
                          Buy
                        </GlowButton>
                      )}
                    </td>
                  </tr>

                  {isExpanded ? (
                    <tr className="bg-bg/35">
                      <td className="px-4 pb-5 pt-0" colSpan={4}>
                        <div className="border border-border bg-bg/60 p-4">
                          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-end">
                            <label>
                              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                                AMOUNT
                              </span>
                              <input
                                className="mt-3 h-11 w-full border border-border bg-bg px-4 font-mono text-base text-text outline-none transition-colors duration-200 placeholder:text-muted focus:border-neon disabled:cursor-not-allowed disabled:bg-muted/20 disabled:text-text-dim"
                                disabled={isBusy(buyStatus)}
                                inputMode="decimal"
                                onChange={(event) => setAmountInput(event.target.value)}
                                value={currentAmountInput}
                              />
                            </label>
                            {buyStatus === "success" || buyStatus === "error" ? (
                              <TransactionStatusPanel
                                errorText={buyErrorText}
                                onReset={resetPurchase}
                                status={buyStatus}
                                successLabel="Purchase successful"
                                txHash={buyTxHash}
                              />
                            ) : (
                              <GlowButton
                                className="w-full gap-2"
                                disabled={isConfirmDisabled}
                                onClick={submitBuy}
                                size="md"
                              >
                                {buyStatus === "pending" ? (
                                  <span className="size-3 animate-spin rounded-full border border-current border-t-transparent motion-reduce:animate-none" />
                                ) : null}
                                <span>{confirmLabel}</span>
                                {buyStatus === "pending" && buyTxHash ? (
                                  <span className="text-[10px]">{shortAddress(buyTxHash)}</span>
                                ) : null}
                              </GlowButton>
                            )}
                          </div>

                          {validationError ? <p className="mt-3 text-sm leading-6 text-down">{validationError}</p> : null}

                          <div className="mt-5 grid gap-3 border-t border-border pt-4 sm:grid-cols-3">
                            <div>
                              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">TOTAL</p>
                              <p className="mt-2 font-mono text-sm text-text">{totalText}</p>
                            </div>
                            <div>
                              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">BALANCE</p>
                              <p className="mt-2 font-mono text-sm text-text-dim">{balanceText}</p>
                            </div>
                            <div>
                              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">AVAILABLE</p>
                              <p className="mt-2 font-mono text-sm text-text-dim">
                                {formatShares(listing.remaining)} SHARES
                              </p>
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {!isLoading && sortedListings.length === 0 ? (
        <div className="mt-6 border border-dashed border-border bg-bg/35 p-6">
          <p className="text-sm leading-6 text-muted">No active sell orders.</p>
        </div>
      ) : null}
    </section>
  );
}
