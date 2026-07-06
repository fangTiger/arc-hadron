import {
  displayCategoryForChainCategory,
  type MarketCategory,
} from "./categories";

export type YieldBucket = "lt4" | "4to6" | "6to10" | "gt10";

export interface FilterAssetOptions {
  category?: MarketCategory | null;
  issuerSlug?: string | null;
  query?: string | null;
  yieldBucket?: YieldBucket | null;
}

export interface FilterableAsset {
  category: string;
  meta: {
    apyBps: number | null;
    displayName: string;
    issuerSlug?: string;
    ticker: string;
  };
}

export const YIELD_BUCKETS: YieldBucket[] = ["lt4", "4to6", "6to10", "gt10"];

export function isYieldBucket(value: string | null): value is YieldBucket {
  return value !== null && (YIELD_BUCKETS as string[]).includes(value);
}

function matchesYieldBucket(apyBps: number | null, bucket: YieldBucket | null | undefined): boolean {
  if (!bucket) {
    return true;
  }

  if (apyBps === null) {
    return false;
  }

  if (bucket === "lt4") {
    return apyBps < 400;
  }

  if (bucket === "4to6") {
    return apyBps >= 400 && apyBps < 600;
  }

  if (bucket === "6to10") {
    return apyBps >= 600 && apyBps < 1000;
  }

  return apyBps >= 1000;
}

export function filterAssets<TAsset extends FilterableAsset>(
  assets: readonly TAsset[],
  options: FilterAssetOptions,
): TAsset[] {
  const category = options.category ?? "all";
  const issuerSlug = options.issuerSlug?.trim() || null;
  const query = options.query?.trim().toLowerCase() ?? "";

  return assets.filter((asset) => {
    const matchesCategory =
      category === "all" || displayCategoryForChainCategory(asset.category) === category;
    const matchesIssuer = issuerSlug === null || asset.meta.issuerSlug === issuerSlug;
    const matchesQuery =
      query.length === 0 ||
      asset.meta.displayName.toLowerCase().includes(query) ||
      asset.meta.ticker.toLowerCase().includes(query);

    return (
      matchesCategory &&
      matchesIssuer &&
      matchesYieldBucket(asset.meta.apyBps, options.yieldBucket) &&
      matchesQuery
    );
  });
}
