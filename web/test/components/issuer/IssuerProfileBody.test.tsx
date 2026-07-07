import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { IssuerProfileBody } from "../../../components/issuer/IssuerProfileBody";
import type { Issuer } from "../../../lib/issuers";
import type { AssetView } from "../../../lib/mappers";

const USDC = 10n ** 18n;

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock("@/lib/hooks/useAssets", () => ({
  useAssets: () => ({
    assets: [assetView()],
    errorZh: undefined,
    isLoading: false,
  }),
}));

vi.mock("@/lib/hooks/useMarketEvents", () => ({
  useMarketEvents: () => ({
    events: [],
    isLoading: false,
    nowMs: Date.UTC(2026, 6, 7, 12),
  }),
}));

function issuer(overrides: Partial<Issuer> = {}): Issuer {
  return {
    assetIds: ["t-bill-2026-q3"],
    description: "Treasury desk",
    displayName: "US Treasury Desk",
    docs: [],
    establishedYear: 1789,
    externalLinks: [],
    focus: "Treasuries",
    jurisdiction: "US",
    shortName: "UST",
    slug: "us-treasury-desk",
    ...overrides,
  };
}

function assetView(overrides: Partial<AssetView> = {}): AssetView {
  return {
    category: "treasuries",
    meta: {
      apyBps: 510,
      description: "Test asset",
      displayName: "US T-Bill 2026-Q3",
      docs: [],
      issuer: "US Treasury Desk",
      issuerSlug: "us-treasury-desk",
      slug: "t-bill-2026-q3",
      ticker: "TBILL",
    },
    name: "US T-BILL 2026-Q3",
    offering: {
      active: true,
      id: 1n,
      pricePerShare: USDC,
      remaining: 500n,
      tokenId: 1n,
    },
    tokenId: 1n,
    totalShares: 1_000n,
    ...overrides,
  };
}

describe("IssuerProfileBody", () => {
  test("keeps event-derived volume in a hydration-safe loading state on first render", () => {
    const html = renderToStaticMarkup(<IssuerProfileBody issuer={issuer()} />);

    expect(html).toContain("Cumulative Volume");
    expect(html).toContain("data-testid=\"issuer-volume-skeleton\"");
    expect(html).not.toContain("0.00 USDC");
  });
});
