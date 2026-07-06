import { describe, expect, test } from "vitest";
import { resolveClaimable } from "../lib/ai/resolveClaimable";

const USDC = 10n ** 18n;
const ADDRESS = "0x1111111111111111111111111111111111111111";

describe("resolveClaimable", () => {
  test("summarizes every token with pending yield when no asset is selected", () => {
    const result = resolveClaimable(ADDRESS, {
      pending: [
        { tokenId: 1n, amount: 0n },
        { tokenId: 2n, amount: 3n * USDC },
        { tokenId: 3n, amount: 5n * USDC },
      ],
    });

    expect(result).toEqual({
      entries: [
        { tokenId: 2n, amount: 3n * USDC },
        { tokenId: 3n, amount: 5n * USDC },
      ],
      total: 8n * USDC,
    });
  });

  test("returns only the selected token when an asset tokenId is selected", () => {
    const result = resolveClaimable(ADDRESS, {
      asset: 3n,
      pending: [
        { tokenId: 2n, amount: 3n * USDC },
        { tokenId: 3n, amount: 5n * USDC },
      ],
    });

    expect(result).toEqual({
      entries: [{ tokenId: 3n, amount: 5n * USDC }],
      total: 5n * USDC,
    });
  });

  test("returns an empty summary when nothing is claimable", () => {
    expect(
      resolveClaimable(ADDRESS, {
        pending: [
          { tokenId: 1n, amount: 0n },
          { tokenId: 2n, amount: 0n },
        ],
      }),
    ).toEqual({ entries: [], total: 0n });

    expect(
      resolveClaimable(ADDRESS, {
        asset: 9n,
        pending: [{ tokenId: 1n, amount: 4n * USDC }],
      }),
    ).toEqual({ entries: [], total: 0n });
  });

  test("returns an empty summary without a wallet address", () => {
    expect(
      resolveClaimable(null, {
        pending: [{ tokenId: 1n, amount: 4n * USDC }],
      }),
    ).toEqual({ entries: [], total: 0n });
  });
});
