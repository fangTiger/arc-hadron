import { describe, expect, test } from "vitest";
import {
  loadAssetsPayload,
  loadListingsPayload,
  loadTradesPayload,
  type PublicQueryClient,
} from "../lib/api/publicQuery";

const SELLER = "0x1111111111111111111111111111111111111111";
const BUYER = "0x2222222222222222222222222222222222222222";
const EVENT_BLOCK = 49_771_987n;

function fakeClient(): PublicQueryClient {
  return {
    async getBlock({ blockNumber }) {
      return { timestamp: blockNumber * 100n };
    },
    async getBlockNumber() {
      return EVENT_BLOCK + 3n;
    },
    async getLogs() {
      return [
        {
          args: {
            amount: 2n,
            buyer: BUYER,
            listingId: 7n,
            seller: SELLER,
            tokenId: 1n,
            totalPaid: 202n,
          },
          blockNumber: EVENT_BLOCK,
          eventName: "Purchased",
          logIndex: 0,
          transactionHash:
            "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
      ];
    },
    async readContract({ functionName, args }) {
      if (functionName === "assetCount") {
        return 1n;
      }

      if (functionName === "offeringCount") {
        return 1n;
      }

      if (functionName === "getAsset") {
        return ["US T-BILL 2026-Q3", "treasuries", 10_000n, "hadron://assets/t-bill-2026-q3"];
      }

      if (functionName === "getOffering") {
        return [1n, 100n, 5_000n, true];
      }

      if (functionName === "listingCount") {
        return 3n;
      }

      if (functionName === "getListing") {
        const id = args?.[0];

        if (id === 1n) {
          return [SELLER, 1n, 120n, 10n, true];
        }

        if (id === 2n) {
          return [SELLER, 2n, 80n, 10n, true];
        }

        return [SELLER, 1n, 90n, 5n, false];
      }

      throw new Error(`Unexpected read: ${String(functionName)}`);
    },
  };
}

describe("public query service", () => {
  test("serializes assets with metadata and string bigint fields", async () => {
    const payload = await loadAssetsPayload({ client: fakeClient() });

    expect(payload.data).toEqual([
      expect.objectContaining({
        category: "treasuries",
        meta: expect.objectContaining({ ticker: "TBILL" }),
        name: "US T-BILL 2026-Q3",
        offering: expect.objectContaining({
          id: "1",
          pricePerShare: "100",
          remaining: "5000",
        }),
        tokenId: "1",
        totalShares: "10000",
      }),
    ]);
  });

  test("filters listings by tokenId and keeps active listings sorted by price", async () => {
    const payload = await loadListingsPayload({ client: fakeClient(), tokenId: 1n });

    expect(payload.data).toEqual([
      {
        id: "1",
        isMine: false,
        pricePerShare: "120",
        remaining: "10",
        seller: SELLER,
        tokenId: "1",
      },
    ]);
  });

  test("returns recent trades with timestamps and string bigint fields", async () => {
    const payload = await loadTradesPayload({ client: fakeClient(), limit: 10, tokenId: 1n });

    expect(payload.data).toEqual([
      expect.objectContaining({
        amount: "2",
        blockNumber: EVENT_BLOCK.toString(),
        listingId: "7",
        pricePerShare: "101",
        timestamp: Number(EVENT_BLOCK * 100n) * 1000,
        tokenId: "1",
        totalPaid: "202",
        type: "purchased",
      }),
    ]);
  });
});
