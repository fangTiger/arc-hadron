"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAccount, useReadContract } from "wagmi";
import { ARC_CHAIN_ID } from "@/lib/chain";
import { validateBidFill } from "@/lib/bid";
import { HADRON_ASSETS_ABI, HADRON_ASSETS_ADDRESS } from "@/lib/contracts";
import { formatShares, formatUsdc, shortAddress } from "@/lib/format";
import { useBids, type BidView } from "@/lib/hooks/useBids";
import { useFillBid } from "@/lib/hooks/useFillBid";
import type { ListForSaleStatus } from "@/lib/hooks/useListForSale";
import { useNetworkGuard } from "@/lib/hooks/useNetworkGuard";
import { stopRowNavigation } from "@/lib/rowNavigation";
import { sharesInputFromUnits, unitPriceToSharePrice } from "@/lib/shares";
import { GlowButton } from "@/components/ui/GlowButton";
import { buildTxExplorerUrl, useToast } from "@/components/ui/TxToast";

interface BidsTableProps {
  initialAmountInput?: string;
  initialExpandedBidId?: bigint;
  tokenBalanceOverride?: bigint;
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

function compareBids(a: BidView, b: BidView): number {
  if (a.pricePerShare !== b.pricePerShare) {
    return a.pricePerShare > b.pricePerShare ? -1 : 1;
  }

  if (a.id === b.id) {
    return 0;
  }

  return a.id < b.id ? -1 : 1;
}

function isFillBusy(status: ListForSaleStatus): boolean {
  return (
    status === "checking" ||
    status === "approving" ||
    status === "approve-pending" ||
    status === "signing" ||
    status === "pending"
  );
}

function fillLabel(status: ListForSaleStatus, defaultLabel = "CONFIRM FILL") {
  switch (status) {
    case "checking":
      return "Checking approval...";
    case "approving":
      return "Confirm approval in wallet...";
    case "approve-pending":
      return "Approving on-chain...";
    case "signing":
      return "Confirm fill in wallet...";
    case "pending":
      return "Filling on-chain...";
    case "success":
      return "Filled";
    case "error":
      return "Retry fill";
    case "idle":
    default:
      return defaultLabel;
  }
}

function TransactionStatusPanel({
  errorText,
  onReset,
  status,
  txHash,
}: {
  errorText?: string;
  onReset: () => void;
  status: ListForSaleStatus;
  txHash?: `0x${string}`;
}) {
  const explorerUrl = process.env.NEXT_PUBLIC_ARC_EXPLORER_URL ?? "";

  if (status === "success") {
    return (
      <div className="border border-up/70 bg-up/10 p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-up">Bid filled</p>
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
          <SecondaryButton onClick={onReset}>Fill again</SecondaryButton>
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

export function BidsTable({
  initialAmountInput,
  initialExpandedBidId,
  tokenBalanceOverride,
  tokenId,
}: BidsTableProps) {
  const [expandedBidId, setExpandedBidId] = useState<bigint | null>(initialExpandedBidId ?? null);
  const [amountInput, setAmountInput] = useState<string | null>(initialAmountInput ?? null);
  const { address, isConnected } = useAccount();
  const { isCorrectChain, switchToArc } = useNetworkGuard();
  const { bids, isLoading } = useBids(tokenId);
  const {
    errorText: fillErrorText,
    fillBid,
    reset: resetFill,
    status: fillStatus,
    txHash: fillTxHash,
  } = useFillBid();
  const queryClient = useQueryClient();
  const { pushError, pushSuccess } = useToast();
  const lastFillToastKey = useRef<string | null>(null);
  const lastFillRefreshKey = useRef<string | null>(null);
  const sortedBids = useMemo(() => [...bids].sort(compareBids), [bids]);
  const expandedBid = sortedBids.find((bid) => bid.id === expandedBidId) ?? null;
  const currentAmountInput = expandedBid
    ? (amountInput ?? sharesInputFromUnits(expandedBid.remaining))
    : "";
  const tokenBalanceQuery = useReadContract({
    address: HADRON_ASSETS_ADDRESS,
    abi: HADRON_ASSETS_ABI,
    chainId: ARC_CHAIN_ID,
    functionName: "balanceOf",
    args: address ? [address, tokenId] : undefined,
    query: {
      enabled: Boolean(address && tokenBalanceOverride === undefined),
      refetchInterval: 8000,
    },
  });
  const { refetch: refetchTokenBalance } = tokenBalanceQuery;
  const tokenBalance = tokenBalanceOverride ?? ((tokenBalanceQuery.data ?? 0n) as bigint);
  const validation = useMemo(() => {
    if (!expandedBid || !isConnected || !isCorrectChain || tokenBalanceQuery.isLoading) {
      return null;
    }

    return validateBidFill({
      amountInput: currentAmountInput,
      balance: tokenBalance,
      remaining: expandedBid.remaining,
    });
  }, [
    currentAmountInput,
    expandedBid,
    isConnected,
    isCorrectChain,
    tokenBalance,
    tokenBalanceQuery.isLoading,
  ]);
  const isBusy = isFillBusy(fillStatus);

  useEffect(() => {
    if (fillStatus === "success" && fillTxHash) {
      const key = `fill-success:${fillTxHash}`;

      if (lastFillRefreshKey.current !== key) {
        lastFillRefreshKey.current = key;
        void Promise.all([
          queryClient.invalidateQueries(),
          refetchTokenBalance(),
        ]).catch(() => undefined);
      }

      if (lastFillToastKey.current !== key) {
        pushSuccess({ message: "Bid filled", txHash: fillTxHash });
        lastFillToastKey.current = key;
      }

      return;
    }

    if (fillStatus === "error" && fillErrorText) {
      const key = `fill-error:${fillErrorText}:${fillTxHash ?? ""}`;

      if (lastFillToastKey.current !== key) {
        pushError(fillErrorText);
        lastFillToastKey.current = key;
      }

      return;
    }

    lastFillToastKey.current = null;
  }, [
    fillErrorText,
    fillStatus,
    fillTxHash,
    pushError,
    pushSuccess,
    queryClient,
    refetchTokenBalance,
  ]);

  function openFill(bid: BidView) {
    setExpandedBidId((current) => (current === bid.id ? null : bid.id));
    setAmountInput(sharesInputFromUnits(bid.remaining));
    resetFill();
  }

  function handleBidRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, bid: BidView) {
    if (bid.isOwn || !isConnected || tokenBalance === 0n || (event.key !== "Enter" && event.key !== " ")) {
      return;
    }

    event.preventDefault();
    openFill(bid);
  }

  function submitFill() {
    if (!expandedBid) {
      return;
    }

    if (!isCorrectChain) {
      switchToArc();
      return;
    }

    if (validation?.ok !== true || fillStatus !== "idle") {
      return;
    }

    fillBid(expandedBid.id, validation.amount);
  }

  function resetFillFlow() {
    lastFillToastKey.current = null;
    resetFill();
  }

  const validationError = validation?.ok === false ? validation.errorText : null;
  const totalValue = validation?.ok && expandedBid ? validation.amount * expandedBid.pricePerShare : null;
  const totalText = totalValue === null ? "—" : `${formatUsdc(totalValue)} USDC`;
  const balanceText = !isConnected
    ? "Not connected"
    : tokenBalanceQuery.isLoading
      ? "Loading..."
      : `${formatShares(tokenBalance)} SHARES`;
  const isConfirmDisabled =
    isBusy ||
    !isConnected ||
    tokenBalance === 0n ||
    tokenBalanceQuery.isLoading ||
    (isConnected && isCorrectChain && validation?.ok !== true);

  return (
    <section className="border border-border bg-panel p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-neon-dim">SECONDARY MARKET</p>
          <h2 className="mt-2 font-mono text-[11px] uppercase tracking-[0.2em] text-text">BUY ORDERS</h2>
        </div>
        <span className="w-fit border border-border bg-bg/60 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
          {isLoading ? "LOADING" : `${sortedBids.length} ACTIVE`}
        </span>
      </div>

      <div className="mt-6 overflow-x-auto border border-border">
        <table className="w-full min-w-[620px] border-collapse">
          <thead className="bg-bg/60">
            <tr className="border-b border-border">
              {["PRICE", "AMOUNT", "BIDDER", "ACTION"].map((label) => (
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
            {sortedBids.map((bid) => {
              const isExpanded = expandedBidId === bid.id;
              const canFill = isConnected && !bid.isOwn && tokenBalance > 0n;

              return (
                <Fragment key={bid.id.toString()}>
                  <tr
                    aria-label={canFill ? `Open fill form for bid ${bid.id.toString()}` : undefined}
                    className={[
                      isExpanded ? "bg-bg/40" : "bg-panel",
                      "transition-colors duration-200 hover:bg-border/20",
                      canFill ? "cursor-pointer" : "",
                    ].join(" ")}
                    onClick={() => {
                      if (canFill) {
                        openFill(bid);
                      }
                    }}
                    onKeyDown={(event) => handleBidRowKeyDown(event, bid)}
                    role={canFill ? "button" : undefined}
                    tabIndex={canFill ? 0 : undefined}
                  >
                    <td className="px-4 py-4 align-middle">
                      <p className="font-mono text-sm text-text">
                        {formatUsdc(unitPriceToSharePrice(bid.pricePerShare))}
                      </p>
                      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                        USDC / SHARE
                      </p>
                    </td>
                    <td className="px-4 py-4 align-middle font-mono text-sm text-text">
                      {formatShares(bid.remaining)}
                    </td>
                    <td className="px-4 py-4 align-middle">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-text-dim">{shortAddress(bid.bidder)}</span>
                        {bid.isOwn ? (
                          <span className="border border-neon/40 bg-neon/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-neon">
                            You
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-middle">
                      <GlowButton
                        disabled={!canFill || isBusy}
                        onClick={(event) => {
                          stopRowNavigation(event);
                          if (canFill) {
                            openFill(bid);
                          }
                        }}
                        size="sm"
                      >
                        Fill
                      </GlowButton>
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
                                disabled={isBusy}
                                inputMode="decimal"
                                onChange={(event) => setAmountInput(event.target.value)}
                                value={currentAmountInput}
                              />
                            </label>
                            {fillStatus === "success" || fillStatus === "error" ? (
                              <TransactionStatusPanel
                                errorText={fillErrorText}
                                onReset={resetFillFlow}
                                status={fillStatus}
                                txHash={fillTxHash}
                              />
                            ) : (
                              <GlowButton
                                className="w-full gap-2"
                                disabled={isConfirmDisabled}
                                onClick={submitFill}
                                size="md"
                              >
                                {fillStatus === "pending" ? (
                                  <span className="size-3 animate-spin rounded-full border border-current border-t-transparent motion-reduce:animate-none" />
                                ) : null}
                                <span>{fillLabel(fillStatus)}</span>
                                {fillStatus === "pending" && fillTxHash ? (
                                  <span className="text-[10px]">{shortAddress(fillTxHash)}</span>
                                ) : null}
                              </GlowButton>
                            )}
                          </div>

                          {validationError ? <p className="mt-3 text-sm leading-6 text-down">{validationError}</p> : null}

                          <div className="mt-5 grid gap-3 border-t border-border pt-4 sm:grid-cols-3">
                            <div>
                              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">BID TOTAL</p>
                              <p className="mt-2 font-mono text-sm text-text">{totalText}</p>
                            </div>
                            <div>
                              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">YOUR SHARES</p>
                              <p className="mt-2 font-mono text-sm text-text-dim">{balanceText}</p>
                            </div>
                            <div>
                              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">BID REMAINING</p>
                              <p className="mt-2 font-mono text-sm text-text-dim">
                                {formatShares(bid.remaining)} SHARES
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

      {!isLoading && sortedBids.length === 0 ? (
        <div className="mt-6 border border-dashed border-border bg-bg/35 p-6">
          <p className="text-sm leading-6 text-muted">No active buy orders.</p>
        </div>
      ) : null}
    </section>
  );
}
