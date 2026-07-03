import { describe, expect, test } from "vitest";
import { fingerprintSnapshot } from "../lib/ai/fingerprint";

function marketSnapshot() {
  return {
    schemaVersion: "hadron-ai-snapshot-v1",
    kind: "market",
    summary: {
      assetCount: 1,
      total24hVolume: "10.00",
    },
    assets: [
      {
        tokenId: "1",
        ticker: "TBILL",
        latestSharePrice: "1.25",
        orderBook: [
          {
            id: "7",
            remaining: "100",
            sharePrice: "1.26",
          },
        ],
      },
    ],
    recentTrades: [
      {
        tokenId: "1",
        txHash: "0xabc",
        logIndex: 2,
        sharePrice: "1.25",
      },
    ],
  };
}

describe("AI snapshot fingerprinting", () => {
  test("hashes normalized snapshot JSON independently of object key order", () => {
    const ordered = marketSnapshot();
    const reordered = {
      recentTrades: [
        {
          sharePrice: "1.25",
          logIndex: 2,
          txHash: "0xabc",
          tokenId: "1",
        },
      ],
      assets: [
        {
          orderBook: [
            {
              sharePrice: "1.26",
              remaining: "100",
              id: "7",
            },
          ],
          latestSharePrice: "1.25",
          ticker: "TBILL",
          tokenId: "1",
        },
      ],
      summary: {
        total24hVolume: "10.00",
        assetCount: 1,
      },
      kind: "market",
      schemaVersion: "hadron-ai-snapshot-v1",
    };

    const first = fingerprintSnapshot(ordered);
    const second = fingerprintSnapshot(reordered);

    expect(first).toBe(second);
    expect(first).toEqual(expect.any(String));
    expect(first.length).toBeGreaterThan(0);
  });

  test("changes when any nested snapshot field changes", () => {
    const base = marketSnapshot();
    const changed = marketSnapshot();
    changed.assets[0].orderBook[0].sharePrice = "1.27";

    expect(fingerprintSnapshot(changed)).not.toBe(fingerprintSnapshot(base));
  });
});
