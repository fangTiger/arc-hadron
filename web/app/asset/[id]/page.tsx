"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { AssetProfile } from "@/components/asset/AssetProfile";
import { BuyPanel } from "@/components/asset/BuyPanel";
import { ListingsPlaceholder } from "@/components/asset/ListingsPlaceholder";
import { glowButtonClassName } from "@/components/ui/GlowButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAssets } from "@/lib/hooks/useAssets";

function AssetDetailSkeleton() {
  return (
    <main className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] lg:px-8">
      <div className="space-y-8">
        <Skeleton className="h-[560px]" />
        <ListingsPlaceholder />
        <ListingsPlaceholder message="交易历史将在 M4 接入" title="TRADE HISTORY" />
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
        <h1 className="mt-4 text-2xl font-semibold text-text">未找到该资产</h1>
        <p className="mt-3 text-sm leading-6 text-text-dim">请返回市场页，从链上资产目录重新选择可浏览的资产。</p>
        <Link className={glowButtonClassName({ className: "mt-8" })} href="/">
          返回市场
        </Link>
      </section>
    </main>
  );
}

export default function AssetDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const { assets, isLoading } = useAssets();
  const asset = assets.find((item) => item.tokenId.toString() === id);
  const isNumericId = /^\d+$/.test(id);

  if (!isNumericId) {
    return <EmptyAssetState />;
  }

  if (!asset) {
    if (isLoading || assets.length === 0) {
      return <AssetDetailSkeleton />;
    }

    return <EmptyAssetState />;
  }

  return (
    <main className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] lg:px-8">
      <div className="space-y-8">
        <AssetProfile asset={asset} />
        <ListingsPlaceholder />
        <ListingsPlaceholder message="交易历史将在 M4 接入" title="TRADE HISTORY" />
      </div>

      <div className="lg:sticky lg:top-24">
        <BuyPanel asset={asset} />
      </div>
    </main>
  );
}
