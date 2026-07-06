import artFraction from "../content/assets/blue-chip-art-fraction-7.json";
import apexIndustrials from "../content/assets/apex-industrials-2029.json";
import carbon from "../content/assets/verra-carbon-9.json";
import bund10y from "../content/assets/de-bund-10y.json";
import dockside from "../content/assets/dockside-logistics-park.json";
import fiber from "../content/assets/fiber-grid-metro-loop.json";
import gold from "../content/assets/gold-ounce-4.json";
import goldOffset from "../content/assets/gold-standard-offset-bundle.json";
import heliosUtility from "../content/assets/helios-utility-2031.json";
import invoicePool from "../content/assets/nexus-invoice-pool-2026-07.json";
import jgb5y from "../content/assets/jp-jgb-5y.json";
import marina from "../content/assets/marina-tower-12f.json";
import meridianCredit from "../content/assets/meridian-sme-credit-a.json";
import receivables from "../content/assets/atlas-trade-receivables-b.json";
import silver from "../content/assets/silver-bullion-vault-2.json";
import solar from "../content/assets/solar-farm-basin-2.json";
import tBill from "../content/assets/t-bill-2026-q3.json";
import tNote from "../content/assets/us-t-note-2028.json";
import { issuerForAsset, registeredIssuerSlugs } from "./issuers";

export interface AssetMeta {
  slug: string;
  displayName: string;
  ticker: string;
  description: string;
  issuerSlug: string;
  issuer: string;
  apyBps: number | null;
  docs: { label: string; note: string }[];
}

type RawAssetMeta = Omit<AssetMeta, "issuer"> & { issuer?: unknown };

const UNKNOWN_META: AssetMeta = {
  slug: "unknown",
  displayName: "Unknown Asset",
  ticker: "—",
  description:
    "This asset has not registered static disclosure metadata yet. HADRON will continue to show on-chain fields while metadata is updated.",
  issuerSlug: "unknown",
  issuer: "HADRON Metadata Registry",
  apyBps: null,
  docs: [
    {
      label: "Metadata placeholder",
      note: "Demo document, not a legal instrument. This placeholder explains how unknown assets are displayed.",
    },
    {
      label: "On-chain data priority",
      note: "Demo document, not a legal instrument. Share balances and transaction states are sourced from contract reads.",
    },
  ],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assetSlugForError(value: unknown): string {
  return isRecord(value) && typeof value.slug === "string" && value.slug.trim() !== ""
    ? value.slug
    : "unknown";
}

export function validateAssetMeta(
  value: unknown,
  knownIssuerSlugs: ReadonlySet<string> = registeredIssuerSlugs(),
): asserts value is RawAssetMeta {
  const slug = assetSlugForError(value);

  if (!isRecord(value)) {
    throw new Error(`Asset ${slug} metadata must be an object.`);
  }

  if (typeof value.issuerSlug !== "string" || value.issuerSlug.trim() === "") {
    throw new Error(`Asset ${slug} issuerSlug is required.`);
  }

  if (!knownIssuerSlugs.has(value.issuerSlug)) {
    throw new Error(
      `Asset ${slug} issuerSlug ${value.issuerSlug} does not match a registered issuer.`,
    );
  }
}

function hydrateAssetMeta(value: unknown): AssetMeta {
  validateAssetMeta(value);

  const issuer = issuerForAsset(value);

  return {
    ...value,
    issuer: issuer.displayName,
  };
}

const ASSET_META_BY_SLUG = new Map<string, AssetMeta>(
  [
    tBill,
    gold,
    marina,
    carbon,
    tNote,
    meridianCredit,
    receivables,
    dockside,
    silver,
    goldOffset,
    solar,
    fiber,
    artFraction,
    invoicePool,
    bund10y,
    jgb5y,
    apexIndustrials,
    heliosUtility,
  ].map((meta) => {
    const hydrated = hydrateAssetMeta(meta);

    return [hydrated.slug, hydrated];
  }),
);

function normalizeSlug(input: string): string {
  const prefix = "hadron://assets/";

  if (input.startsWith(prefix)) {
    return input.slice(prefix.length);
  }

  return input;
}

export function metaBySlug(slug: string): AssetMeta {
  return ASSET_META_BY_SLUG.get(normalizeSlug(slug)) ?? UNKNOWN_META;
}
