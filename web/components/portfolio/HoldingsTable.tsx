"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { useAccount } from "wagmi";
import { WalletButton } from "@/components/layout/WalletButton";
import { ListForSaleModal } from "@/components/portfolio/ListForSaleModal";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { glowButtonClassName } from "@/components/ui/GlowButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { categoryDisplay } from "@/lib/categories";
import { formatShares, formatUsdc } from "@/lib/format";
import { usePortfolio } from "@/lib/hooks/usePortfolio";
import type { Holding } from "@/lib/mappers";

const tableHeaders = ["ASSET", "SHARES", "MARKET VALUE", "AVG COST", "COST BASIS", "ACTIONS"];

interface HoldingsTableViewProps {
  connectAction?: ReactNode;
  errorZh?: string;
  holdings: Holding[];
  isConnected: boolean;
  isLoading: boolean;
  onListForSale?: (holding: Holding) => void;
}

function labelClassName() {
  return "font-mono text-[10px] uppercase tracking-[0.2em] text-muted";
}

function formatMaybeUsdc(value: bigint | null) {
  return value === null ? "—" : `${formatUsdc(value)} USDC`;
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
    <section className="border border-border bg-panel/80 p-8 text-center">
      <p className={labelClassName()}>WALLET REQUIRED</p>
      <h2 className="mt-4 text-2xl font-semibold text-text">Connect wallet to view holdings</h2>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-text-dim">
        Holdings, cost basis, and share balances are read from Arc contracts. Connect to view the
        current address portfolio.
      </p>
      <div className="mt-7 flex justify-center">{connectAction}</div>
    </section>
  );
}

function EmptyState() {
  return (
    <section className="border border-border bg-panel/80 p-8 text-center">
      <p className={labelClassName()}>NO HOLDINGS</p>
      <h2 className="mt-4 text-2xl font-semibold text-text">No holdings yet</h2>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-text-dim">
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
    <section className="border border-down/70 bg-down/10 p-8 text-center">
      <p className={labelClassName()}>READ FAILED</p>
      <h2 className="mt-4 text-2xl font-semibold text-text">Failed to load holdings</h2>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-text-dim">{message}</p>
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
  holding,
  onListForSale,
}: {
  holding: Holding;
  onListForSale?: (holding: Holding) => void;
}) {
  return (
    <tr className="border-t border-border align-middle transition-colors hover:bg-border/20">
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
        {formatMaybeUsdc(holding.avgCost)}
      </td>
      <td className="px-5 py-5 font-mono text-sm tabular-nums text-text-dim">
        {formatMaybeUsdc(holding.costBasis)}
      </td>
      <td className="py-5 pl-5">
        <button
          className="h-9 border border-border bg-bg/50 px-3 font-mono text-[10px] uppercase tracking-[0.2em] text-text-dim transition-colors hover:border-border-glow hover:text-text"
          onClick={() => onListForSale?.(holding)}
          type="button"
        >
          List for sale
        </button>
      </td>
    </tr>
  );
}

export function HoldingsTableView({
  connectAction,
  errorZh,
  holdings,
  isConnected,
  isLoading,
  onListForSale,
}: HoldingsTableViewProps) {
  const totalMarketValue = useMemo(
    () => holdings.reduce((total, holding) => total + holding.marketValue, 0n),
    [holdings],
  );
  const totalMarketValueText = `${formatUsdc(totalMarketValue)} USDC`;

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
    <section className="border border-border bg-panel/80">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse">
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
                  onListForSale={onListForSale}
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
                colSpan={4}
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

export function HoldingsTable() {
  const { isConnected } = useAccount();
  const { errorZh, holdings, isLoading } = usePortfolio();
  const [listingHolding, setListingHolding] = useState<Holding | null>(null);

  return (
    <>
      <HoldingsTableView
        connectAction={<WalletButton />}
        errorZh={errorZh}
        holdings={holdings}
        isConnected={isConnected}
        isLoading={isConnected ? isLoading : false}
        onListForSale={setListingHolding}
      />
      {listingHolding ? (
        <ListForSaleModal
          holding={listingHolding}
          key={listingHolding.asset.tokenId.toString()}
          onClose={() => setListingHolding(null)}
        />
      ) : null}
    </>
  );
}
