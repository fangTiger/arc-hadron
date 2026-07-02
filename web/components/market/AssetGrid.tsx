"use client";

import { useMemo, useState } from "react";
import { useAssets } from "@/lib/hooks/useAssets";
import type { AssetView } from "@/lib/mappers";
import { AssetCard } from "./AssetCard";
import { CategoryTabs, type MarketCategory } from "./CategoryTabs";
import { Skeleton } from "@/components/ui/Skeleton";

function SkeletonCard() {
  return (
    <div className="border border-border bg-panel p-4">
      <Skeleton className="h-36" />
      <Skeleton className="mt-5 h-7 w-2/3" tone="soft" />
      <Skeleton className="mt-3 h-5 w-1/2" tone="soft" />
      <div className="mt-6 grid grid-cols-2 gap-3">
        <Skeleton className="h-16" tone="soft" />
        <Skeleton className="h-16" tone="soft" />
      </div>
      <Skeleton className="mt-6 h-10" />
    </div>
  );
}

export function AssetGrid() {
  const [category, setCategory] = useState<MarketCategory>("all");
  const { assets, errorZh, isLoading } = useAssets();

  return (
    <AssetGridView
      assets={assets}
      category={category}
      errorZh={errorZh}
      isLoading={isLoading}
      onCategoryChange={setCategory}
    />
  );
}

export function AssetGridView({
  assets,
  category,
  errorZh,
  isLoading,
  onCategoryChange,
}: {
  assets: AssetView[];
  category: MarketCategory;
  errorZh?: string;
  isLoading: boolean;
  onCategoryChange: (value: MarketCategory) => void;
}) {
  const filteredAssets = useMemo(
    () => assets.filter((asset) => category === "all" || asset.category === category),
    [assets, category],
  );

  return (
    <section className="space-y-6">
      <CategoryTabs onChange={onCategoryChange} value={category} />

      {errorZh ? (
        <div className="border border-down/70 bg-down/10 p-10 text-center text-sm text-down">
          {errorZh}
        </div>
      ) : isLoading ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 4 }, (_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      ) : filteredAssets.length > 0 ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredAssets.map((asset, index) => (
            <AssetCard asset={asset} featured={index === 0} key={asset.tokenId.toString()} />
          ))}
        </div>
      ) : (
        <div className="border border-border bg-panel/70 p-10 text-center text-sm text-text-dim">
          当前类别暂无活跃资产。
        </div>
      )}
    </section>
  );
}
