import { beforeEach, describe, expect, test } from "vitest";
import {
  loadAssetsPayload,
  loadListingsPayload,
  loadStatusPayload,
  loadTradesPayload,
  type PublicQueryClient,
} from "../lib/api/publicQuery";
import { resetEventIndexForTest } from "../lib/eventIndex";

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
  beforeEach(() => {
    resetEventIndexForTest();
  });

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

  test("keeps fulfilled assets when one Arc RPC detail read fails", async () => {
    const partialClient = fakeClient();
    const baseReadContract = partialClient.readContract;

    partialClient.readContract = async (input) => {
      const id = input.args?.[0];

      if (input.functionName === "assetCount") {
        return 3n;
      }

      if (input.functionName === "offeringCount") {
        return 2n;
      }

      if (input.functionName === "getAsset") {
        if (id === 2n) {
          throw new Error("Arc RPC timeout");
        }

        if (id === 3n) {
          return [
            "GOLD OUNCE 4",
            "commodities",
            20_000n,
            "hadron://assets/gold-ounce-4",
          ];
        }
      }

      if (input.functionName === "getOffering" && id === 2n) {
        throw new Error("Arc RPC timeout");
      }

      return baseReadContract(input);
    };

    const payload = await loadAssetsPayload({ client: partialClient });

    expect(payload.data).toEqual([
      expect.objectContaining({
        offering: expect.objectContaining({ id: "1" }),
        tokenId: "1",
      }),
      expect.objectContaining({
        offering: null,
        tokenId: "3",
        totalShares: "20000",
      }),
    ]);
  });

  test("returns asset data without offerings when the offering count read fails", async () => {
    const partialClient = fakeClient();
    const baseReadContract = partialClient.readContract;

    partialClient.readContract = async (input) => {
      if (input.functionName === "offeringCount") {
        throw new Error("Arc RPC timeout");
      }

      return baseReadContract(input);
    };

    const payload = await loadAssetsPayload({ client: partialClient });

    expect(payload.data).toEqual([
      expect.objectContaining({
        name: "US T-BILL 2026-Q3",
        offering: null,
        tokenId: "1",
      }),
    ]);
  });

  test("falls back to the static asset catalog when all Arc RPC asset detail reads fail", async () => {
    const partialClient = fakeClient();
    const baseReadContract = partialClient.readContract;

    partialClient.readContract = async (input) => {
      if (input.functionName === "assetCount") {
        return 26n;
      }

      if (input.functionName === "offeringCount") {
        throw new Error("Arc RPC timeout");
      }

      if (input.functionName === "getAsset") {
        throw new Error("Arc RPC timeout");
      }

      return baseReadContract(input);
    };

    const payload = await loadAssetsPayload({ client: partialClient });

    expect(payload.data).toHaveLength(26);
    expect(payload.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "treasuries",
          meta: expect.objectContaining({ ticker: "TBILL" }),
          offering: null,
          tokenId: "1",
        }),
        expect.objectContaining({
          category: "music-royalties",
          meta: expect.objectContaining({ ticker: "STREAM" }),
          offering: null,
          tokenId: "26",
        }),
      ]),
    );
  });

  test("falls back to the static asset catalog when the Arc RPC asset count read fails", async () => {
    const partialClient = fakeClient();
    const baseReadContract = partialClient.readContract;

    partialClient.readContract = async (input) => {
      if (input.functionName === "assetCount") {
        throw new Error("Arc RPC timeout");
      }

      return baseReadContract(input);
    };

    const payload = await loadAssetsPayload({ client: partialClient });

    expect(payload.data).toHaveLength(26);
    expect(payload.data[0]).toEqual(
      expect.objectContaining({
        category: "treasuries",
        offering: null,
        tokenId: "1",
      }),
    );
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
    const payload = await loadTradesPayload({
      client: fakeClient(),
      limit: 10,
      tokenId: 1n,
      type: "purchased",
    });

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

  test("returns event index status with string block fields", async () => {
    const client = fakeClient();

    await loadTradesPayload({ client, limit: 10, tokenId: 1n });
    const payload = await loadStatusPayload({ client });

    expect(payload.data).toEqual(
      expect.objectContaining({
        cachedEvents: 1,
        chainId: 5042002,
        indexedBlock: (EVENT_BLOCK + 3n).toString(),
        lagBlocks: "0",
        lastError: null,
        latestBlock: (EVENT_BLOCK + 3n).toString(),
      }),
    );
    expect(typeof payload.data.lastIndexedAt).toBe("string");
  });
});
