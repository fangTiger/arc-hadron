import { describe, expect, test } from "vitest";
import { mapListingResults } from "../lib/listing";

const USDC = 10n ** 18n;
const MINE = "0x1111111111111111111111111111111111111111";
const OTHER = "0x2222222222222222222222222222222222222222";

describe("mapListingResults", () => {
  test("filters inactive listings, sorts active listings by ascending price, and marks my listings", () => {
    const listings = mapListingResults({
      currentAddress: MINE,
      ids: [1n, 2n, 3n, 4n],
      results: [
        {
          active: true,
          pricePerShare: 4n * USDC,
          remaining: 8n,
          seller: OTHER,
          tokenId: 7n,
        },
        {
          active: true,
          pricePerShare: 2n * USDC,
          remaining: 3n,
          seller: MINE,
          tokenId: 7n,
        },
        {
          active: false,
          pricePerShare: 1n * USDC,
          remaining: 2n,
          seller: OTHER,
          tokenId: 7n,
        },
        {
          active: true,
          pricePerShare: 3n * USDC,
          remaining: 5n,
          seller: OTHER,
          tokenId: 7n,
        },
      ],
    });

    expect(listings).toEqual([
      {
        id: 2n,
        isMine: true,
        pricePerShare: 2n * USDC,
        remaining: 3n,
        seller: MINE,
        tokenId: 7n,
      },
      {
        id: 4n,
        isMine: false,
        pricePerShare: 3n * USDC,
        remaining: 5n,
        seller: OTHER,
        tokenId: 7n,
      },
      {
        id: 1n,
        isMine: false,
        pricePerShare: 4n * USDC,
        remaining: 8n,
        seller: OTHER,
        tokenId: 7n,
      },
    ]);
  });

  test("normalizes tuple-shaped getListing results from multicall", () => {
    const listings = mapListingResults({
      currentAddress: MINE,
      ids: [9n],
      results: [[MINE, 12n, 15n * USDC, 4n, true]],
    });

    expect(listings).toEqual([
      {
        id: 9n,
        isMine: true,
        pricePerShare: 15n * USDC,
        remaining: 4n,
        seller: MINE,
        tokenId: 12n,
      },
    ]);
  });
});
