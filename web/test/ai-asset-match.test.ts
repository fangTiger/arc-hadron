import { describe, expect, test } from "vitest";
import { matchAsset } from "../lib/ai/intent";

const REGISTRY = [
  {
    tokenId: 1n,
    name: "Hadron Alpha Treasury",
    meta: { ticker: "HADRON", displayName: "Hadron Alpha Treasury" },
  },
  {
    tokenId: 2n,
    name: "US T-BILL 2026-Q3",
    meta: { ticker: "TBILL", displayName: "US T-Bill 2026 Q3" },
  },
  {
    tokenId: 3n,
    name: "Tokenized Gold Fund",
    meta: { ticker: "GLD", displayName: "Arc Gold Vault" },
  },
  {
    tokenId: 4n,
    name: "Hadron Beta Treasury",
    meta: { ticker: "HBETA", displayName: "Hadron Beta Treasury" },
  },
] as const;

describe("AI asset matching", () => {
  test("matches exact ticker before looser rules", () => {
    expect(matchAsset("HADRON", REGISTRY)).toEqual({
      type: "match",
      tokenId: 1n,
      asset: REGISTRY[0],
    });
  });

  test("matches ticker and display name case-insensitively", () => {
    expect(matchAsset("tbill", REGISTRY)).toEqual({
      type: "match",
      tokenId: 2n,
      asset: REGISTRY[1],
    });
    expect(matchAsset("us t-bill 2026 q3", REGISTRY)).toEqual({
      type: "match",
      tokenId: 2n,
      asset: REGISTRY[1],
    });
  });

  test("matches fuzzy name fragments deterministically", () => {
    expect(matchAsset("gold vault", REGISTRY)).toEqual({
      type: "match",
      tokenId: 3n,
      asset: REGISTRY[2],
    });
  });

  test("returns ordered candidates for ambiguous fuzzy matches", () => {
    expect(matchAsset("treasury", REGISTRY)).toEqual({
      type: "ambiguous",
      candidates: [REGISTRY[0], REGISTRY[3]],
    });
  });

  test("returns null when no asset matches", () => {
    expect(matchAsset("banana futures", REGISTRY)).toBeNull();
    expect(matchAsset("   ", REGISTRY)).toBeNull();
  });
});
