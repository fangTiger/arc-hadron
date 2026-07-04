import { describe, expect, test } from "vitest";
import { resolveBuy } from "../lib/ai/resolveBuy";

function primary(overrides: Partial<Parameters<typeof resolveBuy>[2]["primaryOffering"]> = {}) {
  return {
    active: true,
    id: 1n,
    pricePerShare: 100n,
    remaining: 500n,
    tokenId: 1n,
    ...overrides,
  };
}

function listing(overrides: Partial<Parameters<typeof resolveBuy>[2]["listings"][number]> = {}) {
  return {
    active: true,
    id: 1n,
    pricePerShare: 120n,
    remaining: 500n,
    tokenId: 1n,
    ...overrides,
  };
}

describe("resolveBuy", () => {
  test("returns a single fillable primary source with chain units and total value", () => {
    expect(
      resolveBuy(1n, 2.5, {
        primaryOffering: primary({ id: 7n, pricePerShare: 100n, remaining: 300n }),
        listings: [],
      }),
    ).toEqual({
      kind: "fillable",
      source: { type: "primary", offeringId: 7n },
      pricePerShare: 100n,
      requestedUnits: 250n,
      fillable: 250n,
      totalValue: 25_000n,
    });
  });

  test("chooses the lowest priced source that can fill the full quantity", () => {
    expect(
      resolveBuy(1n, 2, {
        primaryOffering: primary({ pricePerShare: 130n, remaining: 1_000n }),
        listings: [
          listing({ id: 10n, pricePerShare: 115n, remaining: 200n }),
          listing({ id: 9n, pricePerShare: 110n, remaining: 250n }),
        ],
      }),
    ).toMatchObject({
      kind: "fillable",
      source: { type: "listing", listingId: 9n },
      pricePerShare: 110n,
      requestedUnits: 200n,
      fillable: 200n,
      totalValue: 22_000n,
    });
  });

  test("returns a partial downgrade when no single source can fill the requested quantity", () => {
    expect(
      resolveBuy(1n, 3, {
        primaryOffering: primary({ pricePerShare: 100n, remaining: 120n }),
        listings: [
          listing({ id: 4n, pricePerShare: 90n, remaining: 80n }),
          listing({ id: 5n, pricePerShare: 95n, remaining: 200n }),
        ],
      }),
    ).toEqual({
      kind: "partial",
      source: { type: "listing", listingId: 4n },
      pricePerShare: 90n,
      requestedUnits: 300n,
      fillable: 80n,
      totalValue: 7_200n,
    });
  });

  test("excludes sold-out and inactive sources before selecting", () => {
    expect(
      resolveBuy(1n, 1, {
        primaryOffering: primary({ active: false, pricePerShare: 1n, remaining: 1_000n }),
        listings: [
          listing({ id: 1n, pricePerShare: 50n, remaining: 0n }),
          listing({ active: false, id: 2n, pricePerShare: 55n, remaining: 300n }),
          listing({ id: 3n, pricePerShare: 60n, remaining: 100n }),
        ],
      }),
    ).toMatchObject({
      kind: "fillable",
      source: { type: "listing", listingId: 3n },
      pricePerShare: 60n,
    });
  });

  test("prefers primary over secondary listings at the same price", () => {
    expect(
      resolveBuy(1n, 1, {
        primaryOffering: primary({ id: 8n, pricePerShare: 100n, remaining: 100n }),
        listings: [listing({ id: 2n, pricePerShare: 100n, remaining: 100n })],
      }),
    ).toMatchObject({
      kind: "fillable",
      source: { type: "primary", offeringId: 8n },
      pricePerShare: 100n,
    });
  });

  test("returns unavailable when every source is sold out", () => {
    expect(
      resolveBuy(1n, 1, {
        primaryOffering: primary({ remaining: 0n }),
        listings: [listing({ remaining: 0n })],
      }),
    ).toEqual({
      kind: "unavailable",
      requestedUnits: 100n,
      fillable: 0n,
    });
  });
});
