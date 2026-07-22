import artFraction from "../content/assets/blue-chip-art-fraction-7.json";
import apexIndustrials from "../content/assets/apex-industrials-2029.json";
import carbon from "../content/assets/verra-carbon-9.json";
import bund10y from "../content/assets/de-bund-10y.json";
import civicHomeLoans from "../content/issuers/civic-home-loans.json";
import dockside from "../content/assets/dockside-logistics-park.json";
import fiber from "../content/assets/fiber-grid-metro-loop.json";
import gold from "../content/assets/gold-ounce-4.json";
import goldOffset from "../content/assets/gold-standard-offset-bundle.json";
import gpuLease from "../content/assets/gpu-lease-2027.json";
import heliosUtility from "../content/assets/helios-utility-2031.json";
import indieCatalogRoyalty from "../content/assets/indie-catalog-royalty-a.json";
import invoicePool from "../content/assets/nexus-invoice-pool-2026-07.json";
import jgb5y from "../content/assets/jp-jgb-5y.json";
import marina from "../content/assets/marina-tower-12f.json";
import meridianCreditAsset from "../content/assets/meridian-sme-credit-a.json";
import mortgagePool from "../content/assets/prime-mortgage-pool-2026-08.json";
import railcarLease from "../content/assets/railcar-lease-pool-2028.json";
import receivables from "../content/assets/atlas-trade-receivables-b.json";
import sgdLiquidity from "../content/assets/sgd-liquidity-note-2026.json";
import silver from "../content/assets/silver-bullion-vault-2.json";
import solar from "../content/assets/solar-farm-basin-2.json";
import streamingRoyalty from "../content/assets/streaming-royalty-basket-2026.json";
import sunbeltMortgage from "../content/assets/sunbelt-rental-mortgage-b.json";
import tBill from "../content/assets/t-bill-2026-q3.json";
import tNote from "../content/assets/us-t-note-2028.json";
import treasuryMmf from "../content/assets/usdc-treasury-mmf-a.json";
import apexCorporateDesk from "../content/issuers/apex-corporate-desk.json";
import atlasReceivables from "../content/issuers/atlas-receivables.json";
import axiomFineArt from "../content/issuers/axiom-fine-art.json";
import germanyTreasuryDemo from "../content/issuers/germany-treasury-desk.json";
import goldstdCarbon from "../content/issuers/goldstd-carbon.json";
import harborRealEstate from "../content/issuers/harbor-real-estate.json";
import heliosInfrastructure from "../content/issuers/helios-infrastructure.json";
import ironvaleEquipmentTrust from "../content/issuers/ironvale-equipment-trust.json";
import japanTreasuryDemo from "../content/issuers/japan-treasury-desk.json";
import meridianCredit from "../content/issuers/meridian-credit.json";
import northstarLiquidity from "../content/issuers/northstar-liquidity.json";
import polarisMetalsVault from "../content/issuers/polaris-metals-vault.json";
import tempoRoyaltyVault from "../content/issuers/tempo-royalty-vault.json";
import usTreasuryDesk from "../content/issuers/us-treasury-desk.json";
import verraRegistryCarbon from "../content/issuers/verra-registry-carbon.json";
import type { TradeEvent } from "./events";

const DEMO_LINK_PREFIX = "https://demo.hadron.local/";

export interface IssuerDoc {
  label: string;
  note: string;
}

export interface IssuerExternalLink {
  label: string;
  href: string;
}

export interface Issuer {
  slug: string;
  displayName: string;
  shortName: string;
  jurisdiction: string;
  establishedYear: number;
  focus: string;
  description: string;
  docs: IssuerDoc[];
  externalLinks: IssuerExternalLink[];
  assetIds: string[];
}

export interface IssuerKpis {
  assetsCount: number;
  totalShares: bigint;
  cumulativeVolumeUsdc: bigint;
  weightedApyBps: number | null;
}

interface IssuerAssetMeta {
  slug: string;
  issuerSlug?: string;
}

interface KpiAsset {
  tokenId?: bigint | number | string;
  totalShares: bigint | number;
  meta: {
    slug: string;
    issuerSlug: string;
    apyBps: number | null;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(record: Record<string, unknown>, key: string, context: string): string {
  const value = record[key];

  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${context} must define a non-empty ${key}.`);
  }

  return value;
}

function requireNumber(record: Record<string, unknown>, key: string, context: string): number {
  const value = record[key];

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${context} must define a numeric ${key}.`);
  }

  return value;
}

function parseDocs(value: unknown, slug: string): IssuerDoc[] {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new Error(`Issuer ${slug} must define exactly 3 docs.`);
  }

  return value.map((doc, index) => {
    if (!isRecord(doc)) {
      throw new Error(`Issuer ${slug} docs[${index}] must be an object.`);
    }

    return {
      label: requireString(doc, "label", `Issuer ${slug} docs[${index}]`),
      note: requireString(doc, "note", `Issuer ${slug} docs[${index}]`),
    };
  });
}

function parseExternalLinks(value: unknown, slug: string): IssuerExternalLink[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`Issuer ${slug} must define externalLinks.`);
  }

  return value.map((link, index) => {
    if (!isRecord(link)) {
      throw new Error(`Issuer ${slug} externalLinks[${index}] must be an object.`);
    }

    const href = requireString(link, "href", `Issuer ${slug} externalLinks[${index}]`);

    if (!href.startsWith(DEMO_LINK_PREFIX)) {
      throw new Error(
        `Issuer ${slug} externalLinks[${index}].href must start with ${DEMO_LINK_PREFIX}.`,
      );
    }

    return {
      label: requireString(link, "label", `Issuer ${slug} externalLinks[${index}]`),
      href,
    };
  });
}

function validateIssuer(raw: unknown): Omit<Issuer, "assetIds"> {
  if (!isRecord(raw)) {
    throw new Error("Issuer metadata must be an object.");
  }

  const slug = requireString(raw, "slug", "Issuer metadata");

  if ("assetIds" in raw) {
    throw new Error(`Issuer ${slug} must not define assetIds; they are derived from asset JSON.`);
  }

  return {
    slug,
    displayName: requireString(raw, "displayName", `Issuer ${slug}`),
    shortName: requireString(raw, "shortName", `Issuer ${slug}`),
    jurisdiction: requireString(raw, "jurisdiction", `Issuer ${slug}`),
    establishedYear: requireNumber(raw, "establishedYear", `Issuer ${slug}`),
    focus: requireString(raw, "focus", `Issuer ${slug}`),
    description: requireString(raw, "description", `Issuer ${slug}`),
    docs: parseDocs(raw.docs, slug),
    externalLinks: parseExternalLinks(raw.externalLinks, slug),
  };
}

function assetIssuerRef(raw: unknown): IssuerAssetMeta | null {
  if (!isRecord(raw) || typeof raw.slug !== "string") {
    return null;
  }

  return {
    slug: raw.slug,
    issuerSlug: typeof raw.issuerSlug === "string" ? raw.issuerSlug : undefined,
  };
}

function cloneIssuer(issuer: Issuer): Issuer {
  return {
    ...issuer,
    docs: issuer.docs.map((doc) => ({ ...doc })),
    externalLinks: issuer.externalLinks.map((link) => ({ ...link })),
    assetIds: [...issuer.assetIds],
  };
}

function toBigInt(value: bigint | number): bigint {
  return typeof value === "bigint" ? value : BigInt(value);
}

function tokenKey(value: bigint | number | string | undefined): string | null {
  if (value === undefined) {
    return null;
  }

  return value.toString();
}

function roundedRatio(numerator: bigint, denominator: bigint): number {
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  const rounded = remainder * 2n >= denominator ? quotient + 1n : quotient;

  return Number(rounded);
}

const rawIssuers = [
  usTreasuryDesk,
  meridianCredit,
  atlasReceivables,
  harborRealEstate,
  polarisMetalsVault,
  verraRegistryCarbon,
  goldstdCarbon,
  heliosInfrastructure,
  axiomFineArt,
  germanyTreasuryDemo,
  japanTreasuryDemo,
  apexCorporateDesk,
  northstarLiquidity,
  civicHomeLoans,
  ironvaleEquipmentTrust,
  tempoRoyaltyVault,
] as const;

const rawAssets = [
  tBill,
  gold,
  marina,
  carbon,
  tNote,
  meridianCreditAsset,
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
  treasuryMmf,
  sgdLiquidity,
  mortgagePool,
  sunbeltMortgage,
  gpuLease,
  railcarLease,
  indieCatalogRoyalty,
  streamingRoyalty,
] as const;

const issuerBases = rawIssuers.map(validateIssuer);
const issuerSlugs = new Set<string>();

for (const issuer of issuerBases) {
  if (issuerSlugs.has(issuer.slug)) {
    throw new Error(`Duplicate issuer slug: ${issuer.slug}.`);
  }

  issuerSlugs.add(issuer.slug);
}

const assetIdsByIssuerSlug = new Map<string, string[]>(
  issuerBases.map((issuer) => [issuer.slug, []]),
);

for (const rawAsset of rawAssets) {
  const asset = assetIssuerRef(rawAsset);

  if (asset?.issuerSlug && assetIdsByIssuerSlug.has(asset.issuerSlug)) {
    assetIdsByIssuerSlug.get(asset.issuerSlug)?.push(asset.slug);
  }
}

const issuers: Issuer[] = issuerBases.map((issuer) => ({
  ...issuer,
  assetIds: assetIdsByIssuerSlug.get(issuer.slug) ?? [],
}));

const issuerBySlug = new Map(issuers.map((issuer) => [issuer.slug, issuer]));

export function listIssuers(): Issuer[] {
  return issuers.map(cloneIssuer);
}

export function loadIssuerBySlug(slug: string): Issuer | undefined {
  const issuer = issuerBySlug.get(slug);

  return issuer ? cloneIssuer(issuer) : undefined;
}

export function registeredIssuerSlugs(): Set<string> {
  return new Set(issuerBySlug.keys());
}

export function issuerSlugExists(slug: string): boolean {
  return issuerBySlug.has(slug);
}

export function issuerForAsset(assetMeta: { slug: string; issuerSlug?: string }): Issuer {
  if (!assetMeta.issuerSlug) {
    throw new Error(`Asset ${assetMeta.slug} is missing issuerSlug.`);
  }

  const issuer = loadIssuerBySlug(assetMeta.issuerSlug);

  if (!issuer) {
    throw new Error(
      `Asset ${assetMeta.slug} references issuerSlug ${assetMeta.issuerSlug}, but no issuer is registered.`,
    );
  }

  return issuer;
}

export function computeIssuerKpis(
  issuerSlug: string,
  assets: readonly KpiAsset[],
  events: readonly TradeEvent[],
): IssuerKpis {
  const issuerAssets = assets.filter((asset) => asset.meta.issuerSlug === issuerSlug);
  const tokenIds = new Set(
    issuerAssets
      .map((asset) => tokenKey(asset.tokenId))
      .filter((value): value is string => value !== null),
  );
  let totalShares = 0n;
  let weightedNumerator = 0n;
  let weightedDenominator = 0n;

  for (const asset of issuerAssets) {
    const shares = toBigInt(asset.totalShares);
    totalShares += shares;

    if (asset.meta.apyBps !== null) {
      weightedNumerator += BigInt(asset.meta.apyBps) * shares;
      weightedDenominator += shares;
    }
  }

  const cumulativeVolumeUsdc = events.reduce((sum, event) => {
    if (
      (event.type === "primary-sale" || event.type === "purchased") &&
      tokenIds.has(event.tokenId.toString()) &&
      event.totalPaid !== undefined
    ) {
      return sum + event.totalPaid;
    }

    return sum;
  }, 0n);

  return {
    assetsCount: issuerAssets.length,
    totalShares,
    cumulativeVolumeUsdc,
    weightedApyBps:
      weightedDenominator === 0n ? null : roundedRatio(weightedNumerator, weightedDenominator),
  };
}
