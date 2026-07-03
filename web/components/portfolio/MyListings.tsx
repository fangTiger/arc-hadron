"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { buildTxExplorerUrl, useToast } from "@/components/ui/TxToast";
import { formatShares, formatUsdc, shortAddress } from "@/lib/format";
import { useAssets } from "@/lib/hooks/useAssets";
import { useCancelListing } from "@/lib/hooks/useCancelListing";
import { type ListingView, useMyListings } from "@/lib/hooks/useListings";
import { useNetworkGuard } from "@/lib/hooks/useNetworkGuard";
import { unitPriceToSharePrice } from "@/lib/shares";
import {
  handleRowNavigationKeyDown,
  navigateToHref,
  stopRowNavigation,
} from "@/lib/rowNavigation";

type TxHash = `0x${string}`;
type CancelStatus = "idle" | "signing" | "pending" | "success" | "error";

export interface MyListingsViewProps {
  assetNameByTokenId: Map<bigint, string>;
  cancellingId: bigint | null;
  errorText?: string;
  explorerUrl?: string;
  isLoading: boolean;
  listings: ListingView[];
  onAskCancel: (listingId: bigint) => void;
  onCancel: (listingId: bigint | null) => void;
  onDismissConfirm: () => void;
  onNavigate?: (href: string) => void;
  status: CancelStatus;
  txHash?: TxHash;
}

function labelClassName() {
  return "font-mono text-[10px] uppercase tracking-[0.2em] text-muted";
}

function assetNameForListing(listing: ListingView, names: Map<bigint, string>) {
  return names.get(listing.tokenId) ?? `Asset #${listing.tokenId.toString()}`;
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

export function MyListingsView({
  assetNameByTokenId,
  cancellingId,
  errorText,
  explorerUrl = "",
  isLoading,
  listings,
  onAskCancel,
  onCancel,
  onDismissConfirm,
  onNavigate = navigateToHref,
  status,
  txHash,
}: MyListingsViewProps) {
  const isBusy = status === "signing" || status === "pending";

  return (
    <section className="mt-8 border border-border bg-panel/80">
      <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
        <div>
          <p className={labelClassName()}>MY LISTINGS</p>
          <h2 className="mt-2 text-xl font-semibold text-text">Active sell orders</h2>
        </div>
        {isLoading ? (
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-neon-dim">Loading...</p>
        ) : null}
      </div>

      {!isLoading && listings.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="font-mono text-sm text-text-dim">No active listings</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr>
                {["ASSET", "PRICE", "REMAINING", "ACTIONS"].map((header, index) => (
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
              {listings.map((listing) => {
                const isConfirming = cancellingId === listing.id;
                const showTxLink = isConfirming && txHash;
                const assetHref = `/asset/${listing.tokenId.toString()}`;
                const assetName = assetNameForListing(listing, assetNameByTokenId);

                return (
                  <tr
                    aria-label={`Open ${assetName}`}
                    className="cursor-pointer border-t border-border align-middle transition-colors hover:bg-border/20"
                    key={listing.id.toString()}
                    onClick={() => onNavigate(assetHref)}
                    onKeyDown={(event) => handleRowNavigationKeyDown(event, assetHref, onNavigate)}
                    role="link"
                    tabIndex={0}
                  >
                    <td className="py-5 pl-5 pr-4">
                      <p className="text-sm font-semibold text-text">
                        {assetName}
                      </p>
                      <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
                        #{listing.tokenId.toString()} / Listing {listing.id.toString()}
                      </p>
                    </td>
                    <td className="px-4 py-5 font-mono text-sm tabular-nums text-text">
                      {formatUsdc(unitPriceToSharePrice(listing.pricePerShare))} USDC
                    </td>
                    <td className="px-4 py-5 font-mono text-sm tabular-nums text-text-dim">
                      {formatShares(listing.remaining)}
                    </td>
                    <td className="px-4 py-5">
                      {isConfirming ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-down">
                            Confirm cancel?
                          </span>
                          <button
                            className="h-8 border border-down/70 bg-down/10 px-3 font-mono text-[10px] uppercase tracking-[0.2em] text-down disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={isBusy}
                            onClick={(event) => {
                              stopRowNavigation(event);
                              onCancel(listing.id);
                            }}
                            type="button"
                          >
                            {cancelLabel(status)}
                          </button>
                          <button
                            className="h-8 border border-border bg-bg/50 px-3 font-mono text-[10px] uppercase tracking-[0.2em] text-text-dim disabled:cursor-not-allowed disabled:opacity-60"
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
                          className="h-9 border border-border bg-bg/50 px-3 font-mono text-[10px] uppercase tracking-[0.2em] text-text-dim transition-colors hover:border-border-glow hover:text-text"
                          disabled={isBusy}
                          onClick={(event) => {
                            stopRowNavigation(event);
                            onAskCancel(listing.id);
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

export function MyListings() {
  const router = useRouter();
  const [cancellingId, setCancellingId] = useState<bigint | null>(null);
  const { assets } = useAssets();
  const { listings, isLoading } = useMyListings();
  const { cancel, errorText, reset, status, txHash } = useCancelListing();
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
        pushSuccess({ message: "Listing cancelled", txHash });
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
    <MyListingsView
      assetNameByTokenId={assetNameByTokenId}
      cancellingId={cancellingId}
      errorText={errorText}
      explorerUrl={explorerUrl}
      isLoading={isLoading}
      listings={listings}
      onAskCancel={(listingId) => setCancellingId(listingId)}
      onCancel={(listingId) => {
        if (listingId === null) {
          return;
        }

        // 错误网络必须先切链，禁止发起交易（trading-flow 规范）。
        if (!isCorrectChain) {
          switchToArc();
          return;
        }

        cancel(listingId);
      }}
      onDismissConfirm={() => setCancellingId(null)}
      onNavigate={(href) => router.push(href)}
      status={status}
      txHash={txHash}
    />
  );
}
