import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import {
  IssuerActivityListView,
  issuerActivityEvents,
} from "../../../components/issuer/IssuerActivityList";
import type { TradeEvent } from "../../../lib/events";
import type { Issuer } from "../../../lib/issuers";
import type { AssetView } from "../../../lib/mappers";

const USDC = 10n ** 18n;

function issuer(overrides: Partial<Issuer> = {}): Issuer {
  return {
    assetIds: ["asset-a"],
    description: "Demo issuer",
    displayName: "Atlas Demo Issuer",
    docs: [],
    establishedYear: 2011,
    externalLinks: [],
    focus: "Receivables",
    jurisdiction: "Singapore",
    shortName: "ATLAS",
    slug: "atlas-demo",
    ...overrides,
  };
}

function assetView(overrides: Partial<AssetView> = {}): AssetView {
  return {
    category: "private-credit",
    meta: {
      apyBps: 740,
      description: "Demo asset",
      displayName: "Asset A",
      docs: [],
      issuer: "Atlas Demo Issuer",
      issuerSlug: "atlas-demo",
      slug: "asset-a",
      ticker: "ASTA",
    },
    name: "Asset A",
    offering: null,
    tokenId: 10n,
    totalShares: 1_000_000n,
    ...overrides,
  };
}

function tradeEvent(overrides: Partial<TradeEvent> = {}): TradeEvent {
  return {
    amount: 250n,
    blockNumber: 100n,
    logIndex: 1,
    pricePerShare: USDC,
    timestamp: Date.UTC(2026, 6, 6, 10),
    tokenId: 10n,
    totalPaid: 250n * USDC,
    txHash: "0x0000000000000000000000000000000000000000000000000000000000000001",
    type: "primary-sale",
    ...overrides,
  };
}

describe("IssuerActivityList", () => {
  test("filters global market events to issuer asset slugs and renders issuer activity rows", () => {
    const assets = [
      assetView(),
      assetView({
        meta: {
          apyBps: 510,
          description: "Other asset",
          displayName: "Asset B",
          docs: [],
          issuer: "Other Issuer",
          issuerSlug: "other-issuer",
          slug: "asset-b",
          ticker: "ASTB",
        },
        tokenId: 11n,
      }),
    ];
    const events = [
      tradeEvent(),
      tradeEvent({
        logIndex: 2,
        tokenId: 11n,
        txHash: "0x0000000000000000000000000000000000000000000000000000000000000002",
      }),
    ];

    expect(issuerActivityEvents({ assets, events, issuer: issuer() })).toHaveLength(1);

    const html = renderToStaticMarkup(
      <IssuerActivityListView
        assets={assets}
        events={events}
        isLoading={false}
        issuer={issuer()}
        nowMs={Date.UTC(2026, 6, 6, 12)}
      />,
    );

    expect(html).toContain("RECENT ACTIVITY");
    expect(html).toContain("PRIMARY SALE");
    expect(html).toContain("ASTA");
    expect(html).toContain("2.50");
    expect(html).toContain("href=\"https://testnet.arcscan.app/tx/");
    expect(html).not.toContain("ASTB");
  });

  test("renders the issuer-specific empty state when no global events match", () => {
    const html = renderToStaticMarkup(
      <IssuerActivityListView
        assets={[assetView()]}
        events={[tradeEvent({ tokenId: 99n })]}
        isLoading={false}
        issuer={issuer()}
        nowMs={Date.UTC(2026, 6, 6, 12)}
      />,
    );

    expect(html).toContain("No recent activity for this issuer.");
  });
});
