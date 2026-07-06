import { describe, expect, test } from "vitest";
import { computeIssuerKpis } from "../../lib/issuers";
import type { TradeEvent } from "../../lib/events";

const TX = "0x0000000000000000000000000000000000000000000000000000000000000001";

describe("issuer KPI calculations", () => {
  test("uses shares-weighted APY and cumulative primary/purchase volume", () => {
    const assets = [
      {
        tokenId: 1n,
        totalShares: 10_000_000n,
        meta: { slug: "asset-a", issuerSlug: "issuer-a", apyBps: 500 },
      },
      {
        tokenId: 2n,
        totalShares: 5_000_000n,
        meta: { slug: "asset-b", issuerSlug: "issuer-a", apyBps: 1000 },
      },
      {
        tokenId: 3n,
        totalShares: 20_000_000n,
        meta: { slug: "asset-c", issuerSlug: "issuer-b", apyBps: 1200 },
      },
    ];
    const events: TradeEvent[] = [
      {
        type: "primary-sale",
        tokenId: 1n,
        totalPaid: 100n,
        txHash: TX,
        logIndex: 0,
        blockNumber: 1n,
      },
      {
        type: "purchased",
        tokenId: 2n,
        totalPaid: 250n,
        txHash: TX,
        logIndex: 1,
        blockNumber: 1n,
      },
      {
        type: "bid-filled",
        tokenId: 2n,
        totalPaid: 999n,
        txHash: TX,
        logIndex: 2,
        blockNumber: 1n,
      },
      {
        type: "primary-sale",
        tokenId: 3n,
        totalPaid: 500n,
        txHash: TX,
        logIndex: 3,
        blockNumber: 1n,
      },
    ];

    const kpis = computeIssuerKpis("issuer-a", assets, events);

    expect(kpis.assetsCount).toBe(2);
    expect(kpis.totalShares).toBe(15_000_000n);
    expect(kpis.cumulativeVolumeUsdc).toBe(350n);
    // Math.round((500 * 10_000_000 + 1000 * 5_000_000) / 15_000_000) = 667
    expect(kpis.weightedApyBps).toBe(667);
  });
});
