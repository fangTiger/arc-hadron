import { describe, expect, test } from "vitest";
import {
  MARKET_ASSETS_CACHE_VERSION,
  decodeMarketAssetsCache,
  deriveMarketAssetsState,
  encodeMarketAssetsCache,
  fetchMarketAssetsSnapshot,
  parseMarketAssetsPayload,
} from "../lib/marketSnapshot";

const API_PAYLOAD = {
  data: [
    {
      category: "treasuries",
      meta: {
        apyBps: 520,
        description: "Short duration treasury exposure.",
        displayName: "US T-Bill 2026-Q3",
        docs: [{ label: "Term sheet", note: "Illustrative." }],
        issuer: "Apex",
        issuerSlug: "apex-corporate-desk",
        slug: "t-bill-2026-q3",
        ticker: "TBILL",
      },
      name: "US T-BILL 2026-Q3",
      offering: {
        active: true,
        id: "3",
        pricePerShare: "1000000",
        remaining: "5000",
        tokenId: "1",
      },
      tokenId: "1",
      totalShares: "10000",
    },
  ],
  meta: {
    chainId: 5042002,
  },
};

describe("market snapshot client", () => {
  test("parses API bigint strings into AssetView values", () => {
    const assets = parseMarketAssetsPayload(API_PAYLOAD);

    expect(assets).toEqual([
      expect.objectContaining({
        offering: expect.objectContaining({
          id: 3n,
          pricePerShare: 1_000_000n,
          remaining: 5_000n,
          tokenId: 1n,
        }),
        tokenId: 1n,
        totalShares: 10_000n,
      }),
    ]);
    expect(assets[0]?.meta.ticker).toBe("TBILL");
  });

  test("round-trips a versioned last-good snapshot", () => {
    const assets = parseMarketAssetsPayload(API_PAYLOAD);
    const encoded = encodeMarketAssetsCache({
      assets,
      updatedAt: 123_456,
    });

    expect(JSON.parse(encoded)).toMatchObject({
      version: MARKET_ASSETS_CACHE_VERSION,
      updatedAt: 123_456,
    });
    expect(decodeMarketAssetsCache(encoded)).toEqual({
      assets,
      updatedAt: 123_456,
    });
  });

  test("ignores invalid, stale-schema, or malformed cached data", () => {
    expect(decodeMarketAssetsCache("not-json")).toBeNull();
    expect(
      decodeMarketAssetsCache(
        JSON.stringify({
          version: MARKET_ASSETS_CACHE_VERSION + 1,
          updatedAt: 123,
          data: API_PAYLOAD.data,
        }),
      ),
    ).toBeNull();
    expect(
      decodeMarketAssetsCache(
        JSON.stringify({
          version: MARKET_ASSETS_CACHE_VERSION,
          updatedAt: 123,
          data: [{ ...API_PAYLOAD.data[0], tokenId: "invalid" }],
        }),
      ),
    ).toBeNull();
  });

  test("keeps last-good data visible during refresh failures", () => {
    const assets = parseMarketAssetsPayload(API_PAYLOAD);

    expect(
      deriveMarketAssetsState({
        data: assets,
        isError: true,
        isPending: false,
      }),
    ).toEqual({
      assets,
      errorZh: undefined,
      isLoading: false,
    });
    expect(
      deriveMarketAssetsState({
        data: undefined,
        isError: true,
        isPending: false,
      }),
    ).toMatchObject({
      assets: [],
      errorZh: "Failed to load market data from Arc RPC.",
      isLoading: false,
    });
  });

  test("persists only successful API responses and preserves cache on failure", async () => {
    const entries = new Map<string, string>();
    const storage = {
      getItem(key: string) {
        return entries.get(key) ?? null;
      },
      setItem(key: string, value: string) {
        entries.set(key, value);
      },
    };
    const fetcher = async () =>
      new Response(JSON.stringify(API_PAYLOAD), {
        headers: { "content-type": "application/json" },
        status: 200,
      });

    const assets = await fetchMarketAssetsSnapshot({
      fetcher,
      now: () => 987_654,
      storage,
    });
    const beforeFailure = Array.from(entries.entries());

    expect(assets[0]?.tokenId).toBe(1n);
    expect(decodeMarketAssetsCache(storage.getItem("hadron:market-assets:v1"))).toEqual({
      assets,
      updatedAt: 987_654,
    });

    await expect(
      fetchMarketAssetsSnapshot({
        fetcher: async () => new Response("upstream error", { status: 502 }),
        now: () => 999_999,
        storage,
      }),
    ).rejects.toThrow("Market assets request failed with status 502.");
    expect(Array.from(entries.entries())).toEqual(beforeFailure);
  });
});
