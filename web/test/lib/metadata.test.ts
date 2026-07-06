import { describe, expect, test } from "vitest";
import { validateAssetMeta } from "../../lib/metadata";

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
});
