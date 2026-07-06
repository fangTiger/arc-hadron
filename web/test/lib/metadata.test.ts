import { describe, expect, test } from "vitest";
import { validateAssetMeta } from "../../lib/metadata";

const validAsset = {
  slug: "demo-asset",
  displayName: "Demo Asset",
  ticker: "DEMO",
  description: "Demo asset metadata.",
  issuerSlug: "demo-issuer",
  apyBps: 500,
  docs: [
    {
      label: "Demo doc",
      note: "Demo document, not a legal instrument. Placeholder metadata.",
    },
    {
      label: "Demo doc two",
      note: "Demo document, not a legal instrument. Placeholder metadata.",
    },
  ],
};

describe("asset metadata issuerSlug validation", () => {
  test("fails when issuerSlug is missing", () => {
    const { issuerSlug: _issuerSlug, ...missingIssuerSlug } = validAsset;

    expect(() => validateAssetMeta(missingIssuerSlug, new Set(["demo-issuer"]))).toThrow(
      /demo-asset.*issuerSlug is required/,
    );
  });

  test("fails when issuerSlug points to an unknown issuer", () => {
    expect(() =>
      validateAssetMeta(
        { ...validAsset, issuerSlug: "missing-issuer" },
        new Set(["demo-issuer"]),
      ),
    ).toThrow(/demo-asset.*missing-issuer.*does not match a registered issuer/);
  });
});
