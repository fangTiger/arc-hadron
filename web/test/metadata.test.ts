import { describe, expect, test } from "vitest";
import { metaBySlug, type AssetMeta } from "../lib/metadata";

const slugs = [
  "t-bill-2026-q3",
  "gold-ounce-4",
  "marina-tower-12f",
  "verra-carbon-9",
  "us-t-note-2028",
  "meridian-sme-credit-a",
  "atlas-trade-receivables-b",
  "dockside-logistics-park",
  "silver-bullion-vault-2",
  "gold-standard-offset-bundle",
  "solar-farm-basin-2",
  "fiber-grid-metro-loop",
  "blue-chip-art-fraction-7",
  "nexus-invoice-pool-2026-07",
] as const;

const expectedApy: Record<(typeof slugs)[number], number | null> = {
  "t-bill-2026-q3": 510,
  "gold-ounce-4": null,
  "marina-tower-12f": 620,
  "verra-carbon-9": null,
  "us-t-note-2028": 460,
  "meridian-sme-credit-a": 875,
  "atlas-trade-receivables-b": 920,
  "dockside-logistics-park": 710,
  "silver-bullion-vault-2": null,
  "gold-standard-offset-bundle": null,
  "solar-farm-basin-2": 740,
  "fiber-grid-metro-loop": 680,
  "blue-chip-art-fraction-7": null,
  "nexus-invoice-pool-2026-07": 1050,
};

const expectedTickers: Record<(typeof slugs)[number], string> = {
  "t-bill-2026-q3": "TBILL",
  "gold-ounce-4": "GOLD",
  "marina-tower-12f": "RES-12F",
  "verra-carbon-9": "CARB-9",
  "us-t-note-2028": "TNOTE",
  "meridian-sme-credit-a": "PCRD-A",
  "atlas-trade-receivables-b": "PCRD-B",
  "dockside-logistics-park": "DOCK",
  "silver-bullion-vault-2": "SLVR",
  "gold-standard-offset-bundle": "GSOB",
  "solar-farm-basin-2": "SOLR",
  "fiber-grid-metro-loop": "FIBR",
  "blue-chip-art-fraction-7": "ART-7",
  "nexus-invoice-pool-2026-07": "NVIP",
};

function expectCompleteMeta(meta: AssetMeta) {
  expect(meta.slug).toBeTruthy();
  expect(meta.displayName).toBeTruthy();
  expect(meta.ticker).toBeTruthy();
  expect(meta.description).toBeTruthy();
  expect(meta.issuer).toBeTruthy();
  expect(meta.apyBps === null || typeof meta.apyBps === "number").toBe(true);
  expect(meta.docs.length).toBeGreaterThanOrEqual(2);

  for (const doc of meta.docs) {
    expect(doc.label).toBeTruthy();
    expect(doc.note).toContain("Demo document, not a legal instrument.");
  }
}

describe("static asset metadata", () => {
  test("resolves all 14 on-chain slugs with complete English metadata", () => {
    for (const slug of slugs) {
      const meta = metaBySlug(slug);

      expect(meta.slug).toBe(slug);
      expect(meta.apyBps).toBe(expectedApy[slug]);
      expect(meta.ticker).toBe(expectedTickers[slug]);
      expectCompleteMeta(meta);
    }
  });

  test("supports hadron://assets/<slug> metadataURI", () => {
    expect(metaBySlug("hadron://assets/verra-carbon-9").slug).toBe("verra-carbon-9");
  });

  test("returns an English fallback for unknown slugs", () => {
    const meta = metaBySlug("missing-asset");

    expect(meta.slug).toBe("unknown");
    expect(meta.displayName).toBe("Unknown Asset");
    expect(meta.ticker).toBe("—");
    expectCompleteMeta(meta);
  });
});
