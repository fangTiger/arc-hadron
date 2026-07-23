import type { AssetView, ChainOffering } from "@/lib/mappers";
import type { AssetMeta } from "@/lib/metadata";

export const MARKET_ASSETS_QUERY_KEY = ["market-assets-snapshot"] as const;
export const MARKET_ASSETS_CACHE_VERSION = 1;
export const MARKET_ASSETS_CACHE_KEY = `hadron:market-assets:v${MARKET_ASSETS_CACHE_VERSION}`;
export const MARKET_ASSETS_REFRESH_MS = 15_000;
export const MARKET_ASSETS_ERROR_ZH = "Failed to load market data from Arc RPC.";

interface MarketAssetsCache {
  assets: AssetView[];
  updatedAt: number;
}

interface MarketAssetsStateInput {
  data: AssetView[] | undefined;
  isError: boolean;
  isPending: boolean;
}

interface StorageReader {
  getItem(key: string): string | null;
}

interface StorageWriter {
  setItem(key: string, value: string): void;
}

interface FetchMarketAssetsSnapshotOptions {
  fetcher?: (
    input: RequestInfo | URL,
    init?: RequestInit,
  ) => Promise<Response>;
  now?: () => number;
  storage?: StorageWriter;
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function asString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string.`);
  }

  return value;
}

function asBigInt(value: unknown, label: string): bigint {
  const raw = asString(value, label);

  if (!/^\d+$/.test(raw)) {
    throw new Error(`${label} must be an unsigned integer string.`);
  }

  return BigInt(raw);
}

function parseMeta(value: unknown): AssetMeta {
  const meta = asRecord(value, "asset.meta");
  const apyBps = meta.apyBps;
  const docs = meta.docs;

  if (apyBps !== null && (typeof apyBps !== "number" || !Number.isFinite(apyBps))) {
    throw new Error("asset.meta.apyBps must be a finite number or null.");
  }

  if (!Array.isArray(docs)) {
    throw new Error("asset.meta.docs must be an array.");
  }

  return {
    apyBps,
    description: asString(meta.description, "asset.meta.description"),
    displayName: asString(meta.displayName, "asset.meta.displayName"),
    docs: docs.map((entry) => {
      const doc = asRecord(entry, "asset.meta.docs[]");

      return {
        label: asString(doc.label, "asset.meta.docs[].label"),
        note: asString(doc.note, "asset.meta.docs[].note"),
      };
    }),
    issuer: asString(meta.issuer, "asset.meta.issuer"),
    issuerSlug: asString(meta.issuerSlug, "asset.meta.issuerSlug"),
    slug: asString(meta.slug, "asset.meta.slug"),
    ticker: asString(meta.ticker, "asset.meta.ticker"),
  };
}

function parseOffering(value: unknown): ChainOffering | null {
  if (value === null) {
    return null;
  }

  const offering = asRecord(value, "asset.offering");

  if (typeof offering.active !== "boolean") {
    throw new Error("asset.offering.active must be a boolean.");
  }

  return {
    active: offering.active,
    id: asBigInt(offering.id, "asset.offering.id"),
    pricePerShare: asBigInt(offering.pricePerShare, "asset.offering.pricePerShare"),
    remaining: asBigInt(offering.remaining, "asset.offering.remaining"),
    tokenId: asBigInt(offering.tokenId, "asset.offering.tokenId"),
  };
}

function parseAsset(value: unknown): AssetView {
  const asset = asRecord(value, "asset");

  return {
    category: asString(asset.category, "asset.category"),
    meta: parseMeta(asset.meta),
    name: asString(asset.name, "asset.name"),
    offering: parseOffering(asset.offering),
    tokenId: asBigInt(asset.tokenId, "asset.tokenId"),
    totalShares: asBigInt(asset.totalShares, "asset.totalShares"),
  };
}

function serializeAsset(asset: AssetView) {
  return {
    category: asset.category,
    meta: asset.meta,
    name: asset.name,
    offering: asset.offering
      ? {
          active: asset.offering.active,
          id: asset.offering.id.toString(),
          pricePerShare: asset.offering.pricePerShare.toString(),
          remaining: asset.offering.remaining.toString(),
          tokenId: asset.offering.tokenId.toString(),
        }
      : null,
    tokenId: asset.tokenId.toString(),
    totalShares: asset.totalShares.toString(),
  };
}

export function parseMarketAssetsPayload(value: unknown): AssetView[] {
  const payload = asRecord(value, "market assets payload");

  if (!Array.isArray(payload.data)) {
    throw new Error("market assets payload.data must be an array.");
  }

  return payload.data.map(parseAsset);
}

export function encodeMarketAssetsCache({
  assets,
  updatedAt,
}: MarketAssetsCache): string {
  return JSON.stringify({
    data: assets.map(serializeAsset),
    updatedAt,
    version: MARKET_ASSETS_CACHE_VERSION,
  });
}

export function decodeMarketAssetsCache(raw: string | null): MarketAssetsCache | null {
  if (raw === null) {
    return null;
  }

  try {
    const cached = asRecord(JSON.parse(raw), "market assets cache");

    if (
      cached.version !== MARKET_ASSETS_CACHE_VERSION ||
      typeof cached.updatedAt !== "number" ||
      !Number.isFinite(cached.updatedAt) ||
      cached.updatedAt < 0
    ) {
      return null;
    }

    return {
      assets: parseMarketAssetsPayload({ data: cached.data }),
      updatedAt: cached.updatedAt,
    };
  } catch {
    return null;
  }
}

export function readMarketAssetsCache(storage: StorageReader): MarketAssetsCache | null {
  try {
    return decodeMarketAssetsCache(storage.getItem(MARKET_ASSETS_CACHE_KEY));
  } catch {
    return null;
  }
}

export function writeMarketAssetsCache(
  storage: StorageWriter,
  snapshot: MarketAssetsCache,
): void {
  try {
    storage.setItem(MARKET_ASSETS_CACHE_KEY, encodeMarketAssetsCache(snapshot));
  } catch {
    // 隐私模式或存储配额不足时静默退化为仅内存缓存。
  }
}

export async function fetchMarketAssetsSnapshot({
  fetcher = fetch,
  now = Date.now,
  storage,
}: FetchMarketAssetsSnapshotOptions = {}): Promise<AssetView[]> {
  const response = await fetcher("/v1/assets", {
    headers: {
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Market assets request failed with status ${response.status}.`);
  }

  const assets = parseMarketAssetsPayload(await response.json());

  if (storage) {
    writeMarketAssetsCache(storage, {
      assets,
      updatedAt: now(),
    });
  }

  return assets;
}

export function deriveMarketAssetsState({
  data,
  isError,
  isPending,
}: MarketAssetsStateInput): {
  assets: AssetView[];
  errorZh?: string;
  isLoading: boolean;
} {
  const hasData = data !== undefined;

  return {
    assets: data ?? [],
    errorZh: isError && !hasData ? MARKET_ASSETS_ERROR_ZH : undefined,
    isLoading: isPending && !hasData,
  };
}
