import { describe, expect, test } from "vitest";
import { metaBySlug, validateAssetMeta } from "../../lib/metadata";

const validAsset = {
  slug: "illustrative-asset",
  displayName: "Illustrative Asset",
  ticker: "ILUS",
  description: "Illustrative asset metadata.",
  issuerSlug: "illustrative-issuer",
  apyBps: 500,
  docs: [
    {
      label: "Illustrative doc",
      note: "Illustrative document, not a legal instrument. Placeholder metadata.",
    },
    {
      label: "Illustrative doc two",
      note: "Illustrative document, not a legal instrument. Placeholder metadata.",
    },
  ],
};

describe("asset metadata issuerSlug validation", () => {
  test("fails when issuerSlug is missing", () => {
    const missingIssuerSlug: Partial<typeof validAsset> = { ...validAsset };

    delete missingIssuerSlug.issuerSlug;

    expect(() => validateAssetMeta(missingIssuerSlug, new Set(["illustrative-issuer"]))).toThrow(
      /illustrative-asset.*issuerSlug is required/,
    );
  });

  test("fails when issuerSlug points to an unknown issuer", () => {
    expect(() =>
      validateAssetMeta(
        { ...validAsset, issuerSlug: "missing-issuer" },
        new Set(["illustrative-issuer"]),
      ),
    ).toThrow(/illustrative-asset.*missing-issuer.*does not match a registered issuer/);
  });

  test("loads the seeded breadth expansion asset metadata", () => {
    expect(metaBySlug("hadron://assets/usdc-treasury-mmf-a")).toMatchObject({
      issuerSlug: "northstar-liquidity",
      ticker: "MMF-A",
    });
    expect(metaBySlug("hadron://assets/sgd-liquidity-note-2026")).toMatchObject({
      issuerSlug: "northstar-liquidity",
      ticker: "SGD-LIQ",
    });
    expect(metaBySlug("hadron://assets/prime-mortgage-pool-2026-08")).toMatchObject({
      issuerSlug: "civic-home-loans",
      ticker: "MORT-A",
    });
    expect(metaBySlug("hadron://assets/sunbelt-rental-mortgage-b")).toMatchObject({
      issuerSlug: "civic-home-loans",
      ticker: "MORT-B",
    });
    expect(metaBySlug("hadron://assets/gpu-lease-2027")).toMatchObject({
      issuerSlug: "ironvale-equipment-trust",
      ticker: "GPU-27",
    });
    expect(metaBySlug("hadron://assets/railcar-lease-pool-2028")).toMatchObject({
      issuerSlug: "ironvale-equipment-trust",
      ticker: "RAIL-28",
    });
    expect(metaBySlug("hadron://assets/indie-catalog-royalty-a")).toMatchObject({
      issuerSlug: "tempo-royalty-vault",
      ticker: "SONG-A",
    });
    expect(metaBySlug("hadron://assets/streaming-royalty-basket-2026")).toMatchObject({
      issuerSlug: "tempo-royalty-vault",
      ticker: "STREAM",
    });
  });

  test("keeps seeded breadth expansion docs complete", () => {
    const slugs = [
      "usdc-treasury-mmf-a",
      "sgd-liquidity-note-2026",
      "prime-mortgage-pool-2026-08",
      "sunbelt-rental-mortgage-b",
      "gpu-lease-2027",
      "railcar-lease-pool-2028",
      "indie-catalog-royalty-a",
      "streaming-royalty-basket-2026",
    ];

    expect(slugs.map((slug) => metaBySlug(slug).docs)).toEqual(
      slugs.map(() => expect.arrayContaining([expect.any(Object), expect.any(Object), expect.any(Object)])),
    );
  });
});
