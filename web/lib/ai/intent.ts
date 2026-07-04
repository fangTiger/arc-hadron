export type Intent =
  | { kind: "query_price"; asset: string }
  | { kind: "query_depth"; asset: string }
  | { kind: "query_holdings"; asset?: string }
  | { kind: "query_yield" }
  | { kind: "buy"; asset: string; quantity: number }
  | { kind: "unknown" };

export interface AssetMatchable {
  tokenId: bigint | number | string;
  name?: string;
  ticker?: string;
  displayName?: string;
  meta?: {
    ticker?: string;
    displayName?: string;
    slug?: string;
  };
}

export type AssetMatchResult<T extends AssetMatchable> =
  | { type: "match"; tokenId: T["tokenId"]; asset: T }
  | { type: "ambiguous"; candidates: T[] }
  | null;

const UNKNOWN_INTENT: Intent = { kind: "unknown" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();

  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasTwoOrFewerDecimals(value: number): boolean {
  const [, decimals = ""] = value.toString().split(".");

  return decimals.length <= 2;
}

function isValidQuantity(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0 &&
    hasTwoOrFewerDecimals(value)
  );
}

export function isValidIntent(value: unknown): value is Intent {
  if (!isRecord(value) || typeof value.kind !== "string") {
    return false;
  }

  switch (value.kind) {
    case "query_price":
    case "query_depth":
      return hasOnlyKeys(value, ["asset", "kind"]) && isNonEmptyString(value.asset);
    case "query_holdings":
      return (
        (hasOnlyKeys(value, ["kind"]) ||
          (hasOnlyKeys(value, ["asset", "kind"]) && isNonEmptyString(value.asset)))
      );
    case "query_yield":
    case "unknown":
      return hasOnlyKeys(value, ["kind"]);
    case "buy":
      return (
        hasOnlyKeys(value, ["asset", "kind", "quantity"]) &&
        isNonEmptyString(value.asset) &&
        isValidQuantity(value.quantity)
      );
    default:
      return false;
  }
}

export function parseIntent(value: unknown): Intent {
  if (!isValidIntent(value)) {
    return UNKNOWN_INTENT;
  }

  return value;
}

function normalizedText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueLabels(labels: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const label of labels) {
    if (!isNonEmptyString(label) || seen.has(label)) {
      continue;
    }

    seen.add(label);
    unique.push(label);
  }

  return unique;
}

function assetLabels(asset: AssetMatchable): string[] {
  return uniqueLabels([
    asset.ticker,
    asset.displayName,
    asset.name,
    asset.meta?.ticker,
    asset.meta?.displayName,
    asset.meta?.slug,
  ]);
}

function matchResult<T extends AssetMatchable>(matches: T[]): AssetMatchResult<T> {
  if (matches.length === 0) {
    return null;
  }

  if (matches.length === 1) {
    const asset = matches[0];

    return {
      type: "match",
      tokenId: asset.tokenId,
      asset,
    };
  }

  return {
    type: "ambiguous",
    candidates: matches,
  };
}

function matchingAssets<T extends AssetMatchable>(
  registry: readonly T[],
  matchesLabel: (label: string) => boolean,
): T[] {
  return registry.filter((asset) => assetLabels(asset).some(matchesLabel));
}

export function matchAsset<T extends AssetMatchable>(
  query: string,
  registry: readonly T[],
): AssetMatchResult<T> {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return null;
  }

  const exactMatches = matchingAssets(registry, (label) => label.trim() === trimmedQuery);

  if (exactMatches.length > 0) {
    return matchResult(exactMatches);
  }

  const normalizedQuery = normalizedText(trimmedQuery);
  const normalizedMatches = matchingAssets(
    registry,
    (label) => normalizedText(label) === normalizedQuery,
  );

  if (normalizedMatches.length > 0) {
    return matchResult(normalizedMatches);
  }

  const fuzzyMatches = matchingAssets(registry, (label) => {
    const normalizedLabel = normalizedText(label);

    return normalizedLabel.includes(normalizedQuery) || normalizedQuery.includes(normalizedLabel);
  });

  return matchResult(fuzzyMatches);
}
