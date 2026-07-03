import { describe, expect, test } from "vitest";
import * as portfolio from "../lib/hooks/usePortfolio";

const bidder = "0x1000000000000000000000000000000000000001";

interface PortfolioBuyEventsModule {
  portfolioBuyEventsFromLogs?: (
    logs: ReadonlyArray<{
      args: {
        amount?: bigint;
        bidder?: `0x${string}`;
        buyer?: `0x${string}`;
        tokenId?: bigint;
        totalPaid?: bigint;
      };
    }>,
  ) => Array<{ amount: bigint; tokenId: bigint; totalPaid: bigint }>;
}

describe("portfolio buy event mapping", () => {
  test("maps bid-filled logs as buyer cost basis events for the bidder", () => {
    const mapper = (portfolio as PortfolioBuyEventsModule).portfolioBuyEventsFromLogs;

    expect(mapper).toBeTypeOf("function");
    expect(
      mapper?.([
        {
          args: {
            amount: 250n,
            bidder,
            tokenId: 15n,
            totalPaid: 3750000000000000000n,
          },
        },
      ]),
    ).toEqual([
      {
        amount: 250n,
        tokenId: 15n,
        totalPaid: 3750000000000000000n,
      },
    ]);
  });
});
