import { describe, expect, test } from "vitest";
import { issuerForAsset, listIssuers, loadIssuerBySlug } from "../../lib/issuers";

describe("issuer metadata loader", () => {
  test("lists the current issuers with derived asset ids", () => {
    const issuers = listIssuers();

    expect(issuers).toHaveLength(16);
    expect(issuers.map((issuer) => issuer.slug)).toEqual([
      "us-treasury-desk",
      "meridian-credit",
      "atlas-receivables",
      "harbor-real-estate",
      "polaris-metals-vault",
      "verra-registry-carbon",
      "goldstd-carbon",
      "helios-infrastructure",
      "axiom-fine-art",
      "germany-treasury-desk",
      "japan-treasury-desk",
      "apex-corporate-desk",
      "northstar-liquidity",
      "civic-home-loans",
      "ironvale-equipment-trust",
      "tempo-royalty-vault",
    ]);
  });

  test("loads an issuer by slug and returns undefined for missing slugs", () => {
    expect(loadIssuerBySlug("meridian-credit")?.displayName).toBe(
      "Meridian Credit Management LP",
    );
    expect(loadIssuerBySlug("nope")).toBeUndefined();
  });

  test("finds the issuer for an asset and fails clearly when unmatched", () => {
    expect(
      issuerForAsset({ slug: "meridian-sme-credit-a", issuerSlug: "meridian-credit" })
        .displayName,
    ).toBe("Meridian Credit Management LP");

    expect(() => issuerForAsset({ slug: "missing-issuer", issuerSlug: "nope" })).toThrow(
      /missing-issuer.*nope/,
    );
  });

  test("aggregates asset ids from asset metadata instead of issuer JSON", () => {
    expect(loadIssuerBySlug("us-treasury-desk")?.assetIds).toEqual([
      "t-bill-2026-q3",
      "us-t-note-2028",
    ]);
    expect(loadIssuerBySlug("atlas-receivables")?.assetIds).toEqual([
      "atlas-trade-receivables-b",
      "nexus-invoice-pool-2026-07",
    ]);
    expect(loadIssuerBySlug("helios-infrastructure")?.assetIds).toEqual([
      "solar-farm-basin-2",
      "fiber-grid-metro-loop",
      "helios-utility-2031",
    ]);
    expect(loadIssuerBySlug("germany-treasury-desk")?.assetIds).toEqual([
      "de-bund-10y",
    ]);
    expect(loadIssuerBySlug("japan-treasury-desk")?.assetIds).toEqual(["jp-jgb-5y"]);
    expect(loadIssuerBySlug("apex-corporate-desk")?.assetIds).toEqual([
      "apex-industrials-2029",
    ]);
    expect(loadIssuerBySlug("northstar-liquidity")?.assetIds).toEqual([
      "usdc-treasury-mmf-a",
      "sgd-liquidity-note-2026",
    ]);
    expect(loadIssuerBySlug("civic-home-loans")?.assetIds).toEqual([
      "prime-mortgage-pool-2026-08",
      "sunbelt-rental-mortgage-b",
    ]);
    expect(loadIssuerBySlug("ironvale-equipment-trust")?.assetIds).toEqual([
      "gpu-lease-2027",
      "railcar-lease-pool-2028",
    ]);
    expect(loadIssuerBySlug("tempo-royalty-vault")?.assetIds).toEqual([
      "indie-catalog-royalty-a",
      "streaming-royalty-basket-2026",
    ]);
  });
});
