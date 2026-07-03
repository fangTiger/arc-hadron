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
  test("cost basis event set covers primary, secondary purchase, and bid fill", () => {
    const events = (
      portfolio as unknown as {
        PORTFOLIO_BUY_EVENTS?: ReadonlyArray<{
          event: { name: string };
          argsFor: (address: `0x${string}`) => Record<string, unknown>;
        }>;
      }
    ).PORTFOLIO_BUY_EVENTS;

    expect(events).toBeDefined();
    expect(events?.map((entry) => entry.event.name).sort()).toEqual(
      ["BidFilled", "Purchased", "PrimarySale"].sort(),
    );
    // 每类事件按对应买方字段过滤当前地址
    expect(events?.find((entry) => entry.event.name === "Purchased")?.argsFor(bidder)).toEqual({
      buyer: bidder,
    });
    expect(events?.find((entry) => entry.event.name === "BidFilled")?.argsFor(bidder)).toEqual({
      bidder,
    });
    expect(events?.map((entry) => entry.event.name)).not.toContain("YieldDeposited");
    expect(events?.map((entry) => entry.event.name)).not.toContain("YieldClaimed");
  });

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

  test("does not map yield-shaped logs into portfolio cost basis", () => {
    const mapper = (portfolio as PortfolioBuyEventsModule).portfolioBuyEventsFromLogs;

    expect(
      mapper?.([
        {
          args: {
            amount: 12n * 10n ** 18n,
            tokenId: 15n,
          },
        },
      ]),
    ).toEqual([]);
  });
});
