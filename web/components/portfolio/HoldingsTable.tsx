"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { WalletButton } from "@/components/layout/WalletButton";
import { BidsTable } from "@/components/asset/BidsTable";
import { ListForSaleModal } from "@/components/portfolio/ListForSaleModal";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { glowButtonClassName } from "@/components/ui/GlowButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { categoryDisplay } from "@/lib/categories";
import { formatShares, formatUsdc } from "@/lib/format";
import { usePortfolio } from "@/lib/hooks/usePortfolio";
import { useClaimYield, usePendingYield } from "@/lib/hooks/useYield";
import { useNetworkGuard } from "@/lib/hooks/useNetworkGuard";
import type { Holding } from "@/lib/mappers";
import { unitPriceToSharePrice } from "@/lib/shares";
import {
  handleRowNavigationKeyDown,
  navigateToHref,
  stopRowNavigation,
} from "@/lib/rowNavigation";

const tableHeaders = [
  "ASSET",
  "SHARES",
  "MARKET VALUE",
  "AVG COST",
  "COST BASIS",
  "PENDING YIELD",
  "ACTIONS",
];

type YieldClaimStatus = "idle" | "signing" | "pending" | "success" | "error";

interface HoldingsTableViewProps {
  activeClaimTokenId?: bigint | null;
  claimStatus?: YieldClaimStatus;
  connectAction?: ReactNode;
  errorZh?: string;
  holdings: Holding[];
  isCorrectChain?: boolean;
  isConnected: boolean;
  isLoading: boolean;
  onClaimYield?: (holding: Holding) => void;
  onListForSale?: (holding: Holding) => void;
  onSellToBid?: (holding: Holding) => void;
  onNavigate?: (href: string) => void;
  onSwitchNetwork?: () => void;
  pendingYieldByTokenId?: Map<bigint, bigint>;
  totalPendingYield?: bigint;
}

function labelClassName() {
  return "font-mono text-[10px] uppercase tracking-[0.2em] text-muted";
}

function formatMaybeUsdc(value: bigint | null) {
  return value === null ? "—" : `${formatUsdc(value)} USDC`;
}

function formatMaybeSharePrice(value: bigint | null) {
  return value === null ? "—" : `${formatUsdc(unitPriceToSharePrice(value))} USDC`;
}

function LoadingRows() {
  return (
    <>
      {Array.from({ length: 4 }, (_, index) => (
        <tr className="border-t border-border" key={index}>
          <td className="py-5 pr-5">
            <Skeleton className="h-6 w-56" tone="soft" />
            <Skeleton className="mt-3 h-5 w-28" tone="soft" />
          </td>
          <td className="px-5 py-5">
            <Skeleton className="h-6 w-24" tone="soft" />
          </td>
          <td className="px-5 py-5">
            <Skeleton className="h-6 w-32" tone="soft" />
          </td>
          <td className="px-5 py-5">
            <Skeleton className="h-6 w-24" tone="soft" />
          </td>
          <td className="px-5 py-5">
            <Skeleton className="h-6 w-32" tone="soft" />
          </td>
          <td className="px-5 py-5">
            <Skeleton className="h-6 w-28" tone="soft" />
            <Skeleton className="mt-3 h-8 w-20" tone="soft" />
          </td>
          <td className="py-5 pl-5">
            <Skeleton className="h-9 w-28" tone="soft" />
          </td>
        </tr>
      ))}
    </>
  );
}

function DisconnectedState({ connectAction }: { connectAction?: ReactNode }) {
  return (
    <section
      className="border border-border bg-panel/80 px-5 py-8 sm:p-10 text-center"
      data-portfolio-empty-state
    >
      <p className={labelClassName()}>WALLET REQUIRED</p>
      <h2 className="mt-4 text-xl font-semibold text-text sm:text-2xl">Connect wallet to view holdings</h2>
      <p className="mx-auto mt-3 max-w-lg text-[15px] leading-7 text-text-dim sm:text-sm sm:leading-6">
        Holdings, cost basis, and share balances are read from Arc contracts. Connect to view the
        current address portfolio.
      </p>
      <div className="mt-7 flex justify-center">{connectAction}</div>
    </section>
  );
}

function EmptyState() {
  return (
    <section
      className="border border-border bg-panel/80 px-5 py-8 sm:p-10 text-center"
      data-portfolio-empty-state
    >
      <p className={labelClassName()}>NO HOLDINGS</p>
      <h2 className="mt-4 text-xl font-semibold text-text sm:text-2xl">No holdings yet</h2>
      <p className="mx-auto mt-3 max-w-lg text-[15px] leading-7 text-text-dim sm:text-sm sm:leading-6">
        After a primary purchase, shares, market value, and moving-average cost will appear here.
      </p>
      <Link className={glowButtonClassName({ className: "mt-7" })} href="/">
        Browse market
      </Link>
    </section>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <section
      className="border border-down/70 bg-down/10 px-5 py-8 sm:p-10 text-center"
      data-portfolio-empty-state
    >
      <p className={labelClassName()}>READ FAILED</p>
      <h2 className="mt-4 text-xl font-semibold text-text sm:text-2xl">Failed to load holdings</h2>
      <p className="mx-auto mt-3 max-w-lg text-[15px] leading-7 text-text-dim sm:text-sm sm:leading-6">
        {message}
      </p>
    </section>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const display = categoryDisplay(category);

  return (
    <span
      className={[
        "inline-flex border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em]",
        display.tickerClassName,
      ].join(" ")}
    >
      {display.label}
    </span>
  );
}

function HoldingRow({
  activeClaimTokenId = null,
  claimStatus = "idle",
  holding,
  isCorrectChain = true,
  onClaimYield,
  onListForSale,
  onSellToBid,
  onNavigate = navigateToHref,
  onSwitchNetwork,
  pendingYield = 0n,
}: {
  activeClaimTokenId?: bigint | null;
  claimStatus?: YieldClaimStatus;
  holding: Holding;
  isCorrectChain?: boolean;
  onClaimYield?: (holding: Holding) => void;
  onListForSale?: (holding: Holding) => void;
  onSellToBid?: (holding: Holding) => void;
  onNavigate?: (href: string) => void;
  onSwitchNetwork?: () => void;
  pendingYield?: bigint;
}) {
  const assetHref = `/asset/${holding.asset.tokenId.toString()}`;
  const isActiveClaim = activeClaimTokenId === holding.asset.tokenId;
  const isClaimBusy =
    claimStatus === "signing" || claimStatus === "pending";
  const isClaimDisabled =
    pendingYield === 0n ||
    isClaimBusy ||
    (isActiveClaim && claimStatus === "success");
  let claimLabel = "Claim";

  if (!isCorrectChain && pendingYield > 0n) {
    claimLabel = "Switch network";
  } else if (isActiveClaim && claimStatus === "signing") {
    claimLabel = "Confirm...";
  } else if (isActiveClaim && claimStatus === "pending") {
    claimLabel = "Claiming...";
  } else if (isActiveClaim && claimStatus === "success") {
    claimLabel = "Claimed";
  } else if (isActiveClaim && claimStatus === "error") {
    claimLabel = "Retry claim";
  }

  return (
    <tr
      aria-label={`Open ${holding.asset.meta.displayName}`}
      className="cursor-pointer border-t border-border align-middle transition-colors duration-200 hover:bg-border/20"
      onClick={() => onNavigate(assetHref)}
      onKeyDown={(event) => handleRowNavigationKeyDown(event, assetHref, onNavigate)}
      role="link"
      tabIndex={0}
    >
      <td className="min-w-72 py-5 pr-5">
        <div className="flex flex-col gap-3">
          <p className="text-base font-semibold text-text">{holding.asset.meta.displayName}</p>
          <div className="flex flex-wrap items-center gap-2">
            <CategoryBadge category={holding.asset.category} />
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted">
              {holding.asset.meta.ticker} / #{holding.asset.tokenId.toString()}
            </span>
          </div>
        </div>
      </td>
      <td className="px-5 py-5 font-mono text-sm tabular-nums text-text">{formatShares(holding.balance)}</td>
      <td className="px-5 py-5 font-mono text-sm tabular-nums text-text">
        {formatUsdc(holding.marketValue)} USDC
      </td>
      <td className="px-5 py-5 font-mono text-sm tabular-nums text-text-dim">
        {formatMaybeSharePrice(holding.avgCost)}
      </td>
      <td className="px-5 py-5 font-mono text-sm tabular-nums text-text-dim">
        {formatMaybeUsdc(holding.costBasis)}
      </td>
      <td className="px-5 py-5">
        <div className="flex min-w-36 flex-col items-start gap-2">
          <p
            className={[
              "font-mono text-sm tabular-nums",
              pendingYield > 0n ? "text-gold" : "text-text-dim",
            ].join(" ")}
          >
            {formatUsdc(pendingYield)} USDC
          </p>
          <button
            className="h-8 border border-border bg-bg/50 px-3 font-mono text-[10px] uppercase tracking-[0.2em] text-text-dim transition-colors duration-200 hover:border-border-glow hover:text-text disabled:cursor-not-allowed disabled:bg-muted/20 disabled:text-muted"
            disabled={isClaimDisabled}
            onClick={(event) => {
              stopRowNavigation(event);

              if (!isCorrectChain) {
                onSwitchNetwork?.();
                return;
              }

              onClaimYield?.(holding);
            }}
            type="button"
          >
            {claimLabel}
          </button>
        </div>
      </td>
      <td className="py-5 pl-5">
        <div className="flex flex-wrap gap-2">
          <button
            className="h-9 border border-border bg-bg/50 px-3 font-mono text-[10px] uppercase tracking-[0.2em] text-text-dim transition-colors duration-200 hover:border-border-glow hover:text-text"
            onClick={(event) => {
              stopRowNavigation(event);
              onListForSale?.(holding);
            }}
            type="button"
          >
            List for sale
          </button>
          <button
            className="h-9 border border-neon/50 bg-neon/10 px-3 font-mono text-[10px] uppercase tracking-[0.2em] text-neon transition-colors duration-200 hover:border-neon hover:bg-neon/15"
            onClick={(event) => {
              stopRowNavigation(event);
              onSellToBid?.(holding);
            }}
            type="button"
          >
            Sell to bid
          </button>
        </div>
      </td>
    </tr>
  );
}

export function HoldingsTableView({
  activeClaimTokenId = null,
  claimStatus = "idle",
  connectAction,
  errorZh,
  holdings,
  isCorrectChain = true,
  isConnected,
  isLoading,
  onClaimYield,
  onListForSale,
  onSellToBid,
  onNavigate,
  onSwitchNetwork,
  pendingYieldByTokenId = new Map(),
  totalPendingYield,
}: HoldingsTableViewProps) {
  const totalMarketValue = useMemo(
    () => holdings.reduce((total, holding) => total + holding.marketValue, 0n),
    [holdings],
  );
  const totalMarketValueText = `${formatUsdc(totalMarketValue)} USDC`;
  const pendingTotal = useMemo(
    () =>
      totalPendingYield ??
      holdings.reduce(
        (total, holding) => total + (pendingYieldByTokenId.get(holding.asset.tokenId) ?? 0n),
        0n,
      ),
    [holdings, pendingYieldByTokenId, totalPendingYield],
  );
  const pendingTotalText = `${formatUsdc(pendingTotal)} USDC`;

  if (!isConnected) {
    return <DisconnectedState connectAction={connectAction} />;
  }

  if (errorZh) {
    return <ErrorState message={errorZh} />;
  }

  if (!isLoading && holdings.length === 0) {
    return <EmptyState />;
  }

  return (
    <section className="min-w-0 border border-border bg-panel/80">
      <div className="flex flex-col gap-2 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className={labelClassName()}>TOTAL PENDING YIELD</p>
        <p
          aria-label={`Total pending yield ${pendingTotalText}`}
          className="font-mono text-xl font-semibold tabular-nums text-gold"
        >
          {pendingTotalText}
        </p>
      </div>
      <div className="hadron-scroll-frame">
        <table className="w-full min-w-[1080px] border-collapse">
          <thead>
            <tr>
              {tableHeaders.map((header, index) => (
                <th
                  className={[
                    "border-b border-border py-4 text-left",
                    index === 0 ? "pl-0 pr-5" : index === tableHeaders.length - 1 ? "pl-5 pr-0" : "px-5",
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
            {isLoading ? (
              <LoadingRows />
            ) : (
              holdings.map((holding) => (
                <HoldingRow
                  holding={holding}
                  key={holding.asset.tokenId.toString()}
                  activeClaimTokenId={activeClaimTokenId}
                  claimStatus={claimStatus}
                  isCorrectChain={isCorrectChain}
                  onClaimYield={onClaimYield}
                  onListForSale={onListForSale}
                  onSellToBid={onSellToBid}
                  onNavigate={onNavigate}
                  onSwitchNetwork={onSwitchNetwork}
                  pendingYield={pendingYieldByTokenId.get(holding.asset.tokenId) ?? 0n}
                />
              ))
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-border-glow">
              <td className="py-5 pr-5" colSpan={2}>
                <p className={labelClassName()}>TOTAL MARKET VALUE</p>
              </td>
              <td
                aria-label={`Total market value ${totalMarketValueText}`}
                className="px-5 py-5 font-mono text-xl font-semibold tabular-nums text-up"
                colSpan={5}
              >
                <AnimatedNumber value={totalMarketValueText} />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  );
}

function SellToBidModal({
  holding,
  onClose,
}: {
  holding: Holding;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-bg/80 px-4 py-8 backdrop-blur-sm">
      <section
        aria-modal="true"
        className="w-full max-w-4xl border border-border bg-panel p-5 shadow-2xl shadow-bg/60"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border pb-5">
          <div>
            <p className={labelClassName()}>SELL TO BID</p>
            <h2 className="mt-3 text-2xl font-semibold text-text">
              {holding.asset.meta.displayName}
            </h2>
            <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-neon-dim">
              BALANCE {formatShares(holding.balance)} {holding.asset.meta.ticker}
            </p>
          </div>
          <button
            className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted transition-colors duration-200 hover:text-text"
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        <div className="mt-5">
          <BidsTable tokenBalanceOverride={holding.balance} tokenId={holding.asset.tokenId} />
        </div>
      </section>
    </div>
  );
}

export function HoldingsTable() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const { isCorrectChain, switchToArc } = useNetworkGuard();
  const { errorZh, holdings, isLoading } = usePortfolio();
  const tokenIds = useMemo(
    () => holdings.map((holding) => holding.asset.tokenId),
    [holdings],
  );
  const pendingYield = usePendingYield(tokenIds);
  const {
    claim,
    status: claimStatus,
    txHash: claimTxHash,
  } = useClaimYield();
  const queryClient = useQueryClient();
  const [listingHolding, setListingHolding] = useState<Holding | null>(null);
  const [bidHolding, setBidHolding] = useState<Holding | null>(null);
  const [activeClaimTokenId, setActiveClaimTokenId] = useState<bigint | null>(null);
  const lastClaimRefreshKey = useRef<string | null>(null);

  useEffect(() => {
    if (claimStatus !== "success" || !claimTxHash) {
      return;
    }

    const key = `claim:${claimTxHash}`;

    if (lastClaimRefreshKey.current === key) {
      return;
    }

    lastClaimRefreshKey.current = key;
    void queryClient.invalidateQueries().catch(() => undefined);
  }, [claimStatus, claimTxHash, queryClient]);

  function claimHolding(holding: Holding) {
    setActiveClaimTokenId(holding.asset.tokenId);
    claim(holding.asset.tokenId);
  }

  return (
    <>
      <HoldingsTableView
        activeClaimTokenId={activeClaimTokenId}
        claimStatus={claimStatus}
        connectAction={<WalletButton />}
        errorZh={errorZh}
        holdings={holdings}
        isCorrectChain={isCorrectChain}
        isConnected={isConnected}
        isLoading={isConnected ? isLoading : false}
        onClaimYield={claimHolding}
        onListForSale={setListingHolding}
        onSellToBid={setBidHolding}
        onNavigate={(href) => router.push(href)}
        onSwitchNetwork={switchToArc}
        pendingYieldByTokenId={pendingYield.pendingByTokenId}
        totalPendingYield={pendingYield.totalPending}
      />
      {listingHolding ? (
        <ListForSaleModal
          holding={listingHolding}
          key={listingHolding.asset.tokenId.toString()}
          onClose={() => setListingHolding(null)}
        />
      ) : null}
      {bidHolding ? (
        <SellToBidModal
          holding={bidHolding}
          key={bidHolding.asset.tokenId.toString()}
          onClose={() => setBidHolding(null)}
        />
      ) : null}
    </>
  );
}
