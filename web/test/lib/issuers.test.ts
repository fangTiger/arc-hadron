import { describe, expect, test } from "vitest";
import { issuerForAsset, listIssuers, loadIssuerBySlug } from "../../lib/issuers";

describe("issuer metadata loader", () => {
  test("lists the nine batch-1 issuers with derived asset ids", () => {
    const issuers = listIssuers();

    expect(issuers).toHaveLength(9);
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
    ]);
  });
});
