import { beforeEach, describe, expect, test } from "vitest";
import { DEPLOY_BLOCK } from "../lib/chain";
import {
  getEventIndexStatus,
  loadIndexedMarketEvents,
  resetEventIndexForTest,
  type EventIndexClient,
} from "../lib/eventIndex";

const BUYER = "0x2222222222222222222222222222222222222222";
const SELLER = "0x1111111111111111111111111111111111111111";
const TX_A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const TX_B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

function purchasedLog({
  blockNumber,
  logIndex = 0,
  tokenId = 1n,
  txHash = TX_A,
}: {
  blockNumber: bigint;
  logIndex?: number;
  tokenId?: bigint;
  txHash?: `0x${string}`;
}) {
  return {
    args: {
      amount: 2n,
      buyer: BUYER,
      listingId: 7n,
      seller: SELLER,
      tokenId,
      totalPaid: 202n,
    },
    blockNumber,
    eventName: "Purchased",
    logIndex,
    transactionHash: txHash,
  };
}

function fakeIndexClient({
  latestBlock,
  logsForRange,
}: {
  latestBlock: () => bigint;
  logsForRange: (range: { fromBlock: bigint; toBlock: bigint }) => Promise<readonly ReturnType<typeof purchasedLog>[]>;
}): EventIndexClient & { ranges: { fromBlock: bigint; toBlock: bigint }[] } {
  const ranges: { fromBlock: bigint; toBlock: bigint }[] = [];

  return {
    ranges,
    async getBlockNumber() {
      return latestBlock();
    },
    async getLogs({ fromBlock, toBlock }) {
      ranges.push({ fromBlock, toBlock });

      return logsForRange({ fromBlock, toBlock });
    },
  };
}

describe("event index", () => {
  beforeEach(() => {
    resetEventIndexForTest();
  });

  test("indexes the deployment range on first load", async () => {
    const latest = BigInt(DEPLOY_BLOCK) + 2n;
    const client = fakeIndexClient({
      latestBlock: () => latest,
      logsForRange: async () => [purchasedLog({ blockNumber: latest })],
    });

    const events = await loadIndexedMarketEvents({ client });

    expect(events).toHaveLength(1);
    expect(client.ranges).toEqual([{ fromBlock: BigInt(DEPLOY_BLOCK), toBlock: latest }]);
    expect(getEventIndexStatus()).toMatchObject({
      cachedEvents: 1,
      indexedBlock: latest,
      lastError: null,
      latestBlock: latest,
    });
  });

  test("uses indexedBlock plus one for incremental loads", async () => {
    let latest = BigInt(DEPLOY_BLOCK);
    const client = fakeIndexClient({
      latestBlock: () => latest,
      logsForRange: async ({ toBlock }) => [purchasedLog({ blockNumber: toBlock, txHash: toBlock === latest ? TX_A : TX_B })],
    });

    await loadIndexedMarketEvents({ client });
    latest = BigInt(DEPLOY_BLOCK) + 2n;
    await loadIndexedMarketEvents({ client });

    expect(client.ranges).toEqual([
      { fromBlock: BigInt(DEPLOY_BLOCK), toBlock: BigInt(DEPLOY_BLOCK) },
      { fromBlock: BigInt(DEPLOY_BLOCK) + 1n, toBlock: BigInt(DEPLOY_BLOCK) + 2n },
    ]);
  });

  test("deduplicates events by chain, tx hash, and log index", async () => {
    const latest = BigInt(DEPLOY_BLOCK);
    const duplicate = purchasedLog({ blockNumber: latest });
    const client = fakeIndexClient({
      latestBlock: () => latest,
      logsForRange: async () => [duplicate, duplicate],
    });

    const events = await loadIndexedMarketEvents({ client });

    expect(events).toHaveLength(1);
    expect(getEventIndexStatus().cachedEvents).toBe(1);
  });

  test("keeps cached events and last indexed block when incremental load fails", async () => {
    let latest = BigInt(DEPLOY_BLOCK);
    let shouldFail = false;
    const client = fakeIndexClient({
      latestBlock: () => latest,
      logsForRange: async () => {
        if (shouldFail) {
          throw new Error("RPC down");
        }

        return [purchasedLog({ blockNumber: latest })];
      },
    });

    await loadIndexedMarketEvents({ client });
    latest = BigInt(DEPLOY_BLOCK) + 1n;
    shouldFail = true;

    const events = await loadIndexedMarketEvents({ client });

    expect(events).toHaveLength(1);
    expect(getEventIndexStatus()).toMatchObject({
      cachedEvents: 1,
      indexedBlock: BigInt(DEPLOY_BLOCK),
      lastError: expect.stringContaining("RPC down"),
      latestBlock: BigInt(DEPLOY_BLOCK) + 1n,
    });
  });
});
