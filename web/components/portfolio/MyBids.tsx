"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { buildTxExplorerUrl, useToast } from "@/components/ui/TxToast";
import { formatShares, formatUsdc, shortAddress } from "@/lib/format";
import { useAssets } from "@/lib/hooks/useAssets";
import { type BidView, useMyBids } from "@/lib/hooks/useBids";
import { useCancelBid } from "@/lib/hooks/useCancelBid";
import { useNetworkGuard } from "@/lib/hooks/useNetworkGuard";
import { unitPriceToSharePrice } from "@/lib/shares";
import {
  handleRowNavigationKeyDown,
  navigateToHref,
  stopRowNavigation,
} from "@/lib/rowNavigation";

type TxHash = `0x${string}`;
type CancelStatus = "idle" | "signing" | "pending" | "success" | "error";

export interface MyBidsViewProps {
  assetNameByTokenId: Map<bigint, string>;
  bids: BidView[];
  cancellingId: bigint | null;
  errorText?: string;
  explorerUrl?: string;
  isLoading: boolean;
  onAskCancel: (bidId: bigint) => void;
  onCancel: (bidId: bigint | null) => void;
  onDismissConfirm: () => void;
  onNavigate?: (href: string) => void;
  status: CancelStatus;
  txHash?: TxHash;
}

function labelClassName() {
  return "font-mono text-[10px] uppercase tracking-[0.2em] text-muted";
}

function assetNameForBid(bid: BidView, names: Map<bigint, string>) {
  return names.get(bid.tokenId) ?? `Asset #${bid.tokenId.toString()}`;
}

function cancelLabel(status: CancelStatus) {
  if (status === "signing") {
    return "Confirm in wallet...";
  }

  if (status === "pending") {
    return "Cancelling...";
  }

  return "Confirm";
}

export function MyBidsView({
  assetNameByTokenId,
  bids,
  cancellingId,
  errorText,
  explorerUrl = "",
  isLoading,
  onAskCancel,
  onCancel,
  onDismissConfirm,
  onNavigate = navigateToHref,
  status,
  txHash,
}: MyBidsViewProps) {
  const isBusy = status === "signing" || status === "pending";

  return (
    <section className="mt-8 border border-border bg-panel/80">
      <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
        <div>
          <p className={labelClassName()}>MY BIDS</p>
          <h2 className="mt-2 text-xl font-semibold text-text">Active buy orders</h2>
        </div>
        {isLoading ? (
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-neon-dim">LOADING</p>
        ) : null}
      </div>

      {!isLoading && bids.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">NO ACTIVE BIDS</p>
          <p className="mt-3 text-sm text-text-dim">No active bids. Buy orders created from asset pages appear here.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse">
            <thead>
              <tr>
                {["ASSET", "PRICE", "REMAINING", "ESCROW", "ACTIONS"].map((header, index) => (
                  <th
                    className={[
                      "border-b border-border py-4 text-left",
                      index === 0 ? "pl-5 pr-4" : "px-4",
                      labelClassName(),
                    ].join(" ")}
                    key={header}
                    scope="col"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bids.map((bid) => {
                const isConfirming = cancellingId === bid.id;
                const showTxLink = isConfirming && txHash;
                const assetHref = `/asset/${bid.tokenId.toString()}`;
                const assetName = assetNameForBid(bid, assetNameByTokenId);
                const escrow = bid.remaining * bid.pricePerShare;

                return (
                  <tr
                    aria-label={`Open ${assetName}`}
                    className="cursor-pointer border-t border-border align-middle transition-colors duration-200 hover:bg-border/20"
                    key={bid.id.toString()}
                    onClick={() => onNavigate(assetHref)}
                    onKeyDown={(event) => handleRowNavigationKeyDown(event, assetHref, onNavigate)}
                    role="link"
                    tabIndex={0}
                  >
                    <td className="py-5 pl-5 pr-4">
                      <p className="text-sm font-semibold text-text">{assetName}</p>
                      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                        #{bid.tokenId.toString()} / Bid {bid.id.toString()}
                      </p>
                    </td>
                    <td className="px-4 py-5 font-mono text-sm tabular-nums text-text">
                      {formatUsdc(unitPriceToSharePrice(bid.pricePerShare))} USDC
                    </td>
                    <td className="px-4 py-5 font-mono text-sm tabular-nums text-text-dim">
                      {formatShares(bid.remaining)}
                    </td>
                    <td className="px-4 py-5 font-mono text-sm tabular-nums text-text-dim">
                      {formatUsdc(escrow)} USDC
                    </td>
                    <td className="px-4 py-5">
                      {isConfirming ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-down">
                            Confirm cancel?
                          </span>
                          <button
                            className="h-8 border border-down/70 bg-down/10 px-3 font-mono text-[10px] uppercase tracking-[0.2em] text-down transition-colors duration-200 hover:bg-down/15 disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={isBusy}
                            onClick={(event) => {
                              stopRowNavigation(event);
                              onCancel(bid.id);
                            }}
                            type="button"
                          >
                            {cancelLabel(status)}
                          </button>
                          <button
                            className="h-8 border border-border bg-bg/50 px-3 font-mono text-[10px] uppercase tracking-[0.2em] text-text-dim transition-colors duration-200 hover:border-border-glow hover:text-text disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={isBusy}
                            onClick={(event) => {
                              stopRowNavigation(event);
                              onDismissConfirm();
                            }}
                            type="button"
                          >
                            Keep
                          </button>
                          {showTxLink ? (
                            <a
                              className="font-mono text-[10px] uppercase tracking-[0.2em] text-neon-dim underline-offset-4 hover:text-neon hover:underline"
                              href={buildTxExplorerUrl(explorerUrl, txHash)}
                              onClick={stopRowNavigation}
                              rel="noreferrer"
                              target="_blank"
                            >
                              {shortAddress(txHash)}
                            </a>
                          ) : null}
                        </div>
                      ) : (
                        <button
                          className="h-9 border border-border bg-bg/50 px-3 font-mono text-[10px] uppercase tracking-[0.2em] text-text-dim transition-colors duration-200 hover:border-border-glow hover:text-text"
                          disabled={isBusy}
                          onClick={(event) => {
                            stopRowNavigation(event);
                            onAskCancel(bid.id);
                          }}
                          type="button"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {status === "error" ? (
        <p className="border-t border-down/70 bg-down/10 px-5 py-4 text-sm leading-6 text-down">
          {errorText ?? "Transaction failed, please retry"}
        </p>
      ) : null}
    </section>
  );
}

export function MyBids() {
  const router = useRouter();
  const [cancellingId, setCancellingId] = useState<bigint | null>(null);
  const { assets } = useAssets();
  const { bids, isLoading } = useMyBids();
  const { cancelBid, errorText, reset, status, txHash } = useCancelBid();
  const { isCorrectChain, switchToArc } = useNetworkGuard();
  const { pushError, pushSuccess } = useToast();
  const queryClient = useQueryClient();
  const lastNoticeKey = useRef<string | null>(null);
  const explorerUrl = process.env.NEXT_PUBLIC_ARC_EXPLORER_URL ?? "";
  const assetNameByTokenId = new Map(
    assets.map((asset) => [asset.tokenId, asset.meta.displayName]),
  );

  useEffect(() => {
    if (status === "success" && txHash) {
      const key = `success:${txHash}`;

      if (lastNoticeKey.current !== key) {
        pushSuccess({ message: "Bid cancelled", txHash });
        lastNoticeKey.current = key;
        setCancellingId(null);
        void queryClient.invalidateQueries().catch(() => undefined);
        reset();
      }

      return;
    }

    if (status === "error" && errorText) {
      const key = `error:${errorText}:${txHash ?? ""}`;

      if (lastNoticeKey.current !== key) {
        pushError(errorText);
        lastNoticeKey.current = key;
      }

      return;
    }

    lastNoticeKey.current = null;
  }, [errorText, pushError, pushSuccess, queryClient, reset, status, txHash]);

  return (
    <MyBidsView
      assetNameByTokenId={assetNameByTokenId}
      bids={bids}
      cancellingId={cancellingId}
      errorText={errorText}
      explorerUrl={explorerUrl}
      isLoading={isLoading}
      onAskCancel={(bidId) => setCancellingId(bidId)}
      onCancel={(bidId) => {
        if (bidId === null) {
          return;
        }

        // 错误网络必须先切链，禁止发起交易（trading-flow 规范）。
        if (!isCorrectChain) {
          switchToArc();
          return;
        }

        cancelBid(bidId);
      }}
      onDismissConfirm={() => setCancellingId(null)}
      onNavigate={(href) => router.push(href)}
      status={status}
      txHash={txHash}
    />
  );
}
