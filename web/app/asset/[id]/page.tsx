"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AssetProfile } from "@/components/asset/AssetProfile";
import { BuyPanel } from "@/components/asset/BuyPanel";
import { ListingsPlaceholder } from "@/components/asset/ListingsPlaceholder";
import { glowButtonClassName } from "@/components/ui/GlowButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAssets } from "@/lib/hooks/useAssets";
import type { AssetView } from "@/lib/mappers";

function AssetDetailSkeleton() {
  return (
    <main className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] lg:px-8">
      <div className="space-y-8">
        <Skeleton className="h-[560px]" />
        <ListingsPlaceholder />
        <ListingsPlaceholder message="Trade history lands in M4" title="TRADE HISTORY" />
      </div>
      <aside className="lg:sticky lg:top-24">
        <Skeleton className="h-[420px]" tone="soft" />
        <p className="sr-only">REMAINING SHARES</p>
      </aside>
    </main>
  );
}

function EmptyAssetState() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-3xl items-center px-4 py-16 text-center sm:px-6">
      <section className="w-full border border-border bg-panel p-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-down">ASSET NOT FOUND</p>
        <h1 className="mt-4 text-2xl font-semibold text-text">Asset not found</h1>
        <p className="mt-3 text-sm leading-6 text-text-dim">
          Return to the market and select an asset from the on-chain catalog.
        </p>
        <Link className={glowButtonClassName({ className: "mt-8" })} href="/">
          Back to market
        </Link>
      </section>
    </main>
  );
}

function AssetReadErrorState({ message }: { message: string }) {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-3xl items-center px-4 py-16 text-center sm:px-6">
      <section className="w-full border border-down/70 bg-down/10 p-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-down">CHAIN READ FAILED</p>
        <h1 className="mt-4 text-2xl font-semibold text-text">Failed to load asset</h1>
        <p className="mt-3 text-sm leading-6 text-text-dim">{message}</p>
        <Link className={glowButtonClassName({ className: "mt-8" })} href="/">
          Back to market
        </Link>
      </section>
    </main>
  );
}

export function AssetDetailView({
  assets,
  errorZh,
  id,
  isLoading,
}: {
  assets: AssetView[];
  errorZh?: string;
  id: string;
  isLoading: boolean;
}) {
  const isNumericId = /^\d+$/.test(id);
  const asset = assets.find((item) => item.tokenId.toString() === id);

  if (!isNumericId) {
    return <EmptyAssetState />;
  }

  if (!asset) {
    if (errorZh) {
      return <AssetReadErrorState message={errorZh} />;
    }

    if (isLoading) {
      return <AssetDetailSkeleton />;
    }

    return <EmptyAssetState />;
  }

  return (
    <main className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] lg:px-8">
      <div className="space-y-8">
        <AssetProfile asset={asset} />
        <ListingsPlaceholder />
        <ListingsPlaceholder message="Trade history lands in M4" title="TRADE HISTORY" />
      </div>

      <div className="lg:sticky lg:top-24">
        <BuyPanel asset={asset} />
      </div>
    </main>
  );
}

export default function AssetDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const { assets, errorZh, isLoading } = useAssets();

  return <AssetDetailView assets={assets} errorZh={errorZh} id={id} isLoading={isLoading} />;
}
