import { describe, expect, test, vi } from "vitest";
import {
  encodeAbiParameters,
  encodeEventTopics,
  parseAbiItem,
  type AbiEvent,
  type AbiParameter,
  type Hex,
} from "viem";
import { fetchLogsInBlockRange } from "../lib/eventLogs";
import { parseMarketLogs } from "../lib/events";

interface TestLog {
  blockNumber: bigint;
  id: string;
}

const bidPlacedAbi = parseAbiItem(
  "event BidPlaced(uint256 indexed bidId, uint256 indexed tokenId, address indexed bidder, uint256 pricePerShare, uint256 amount)",
) as AbiEvent;
const bidFilledAbi = parseAbiItem(
  "event BidFilled(uint256 indexed bidId, uint256 indexed tokenId, address indexed bidder, address seller, uint256 amount, uint256 totalPaid, uint256 fee)",
) as AbiEvent;
const buyer = "0x1000000000000000000000000000000000000001";
const seller = "0x2000000000000000000000000000000000000002";

function hash(index: number): Hex {
  return `0x${index.toString(16).padStart(64, "0")}`;
}

function rawLog({
  abi,
  args,
  blockNumber,
  logIndex,
}: {
  abi: AbiEvent;
  args: readonly unknown[];
  blockNumber: bigint;
  logIndex: number;
}) {
  const topics = encodeEventTopics({
    abi: [abi],
    args,
    eventName: abi.name,
  });
  const nonIndexedInputs = abi.inputs.filter((input) => !("indexed" in input && input.indexed));
  const nonIndexedArgs = abi.inputs.flatMap((input, index) =>
    "indexed" in input && input.indexed ? [] : [args[index]],
  );

  return {
    blockNumber,
    data:
      nonIndexedInputs.length === 0
        ? "0x"
        : encodeAbiParameters(nonIndexedInputs as AbiParameter[], nonIndexedArgs),
    logIndex,
    topics,
    transactionHash: hash(logIndex + 1),
  };
}

describe("fetchLogsInBlockRange", () => {
  test("splits ranges over the RPC log limit into 9000-block chunks", async () => {
    const chunks: Array<{ from: bigint; to: bigint }> = [];

    const logs = await fetchLogsInBlockRange<TestLog>({
      fromBlock: 100n,
      getLogs: async (chunk) => {
        chunks.push(chunk);

        return [{ blockNumber: chunk.from, id: `${chunk.from.toString()}-${chunk.to.toString()}` }];
      },
      retryCount: 0,
      toBlock: 18_100n,
    });

    expect(chunks).toEqual([
      { from: 100n, to: 9_099n },
      { from: 9_100n, to: 18_099n },
      { from: 18_100n, to: 18_100n },
    ]);
    expect(chunks.every((chunk) => chunk.to - chunk.from + 1n <= 9_000n)).toBe(true);
    expect(logs).toHaveLength(3);
  });

  test("retries a failing chunk once and skips it when other chunks succeed", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const attempts = new Map<string, number>();

    const logs = await fetchLogsInBlockRange<TestLog>({
      concurrency: 2,
      fromBlock: 1n,
      getLogs: async (chunk) => {
        const key = `${chunk.from.toString()}-${chunk.to.toString()}`;
        attempts.set(key, (attempts.get(key) ?? 0) + 1);

        if (chunk.from === 9_001n) {
          throw new Error("RPC 413");
        }

        return [{ blockNumber: chunk.from, id: key }];
      },
      retryCount: 1,
      toBlock: 18_000n,
    });

    expect(logs).toEqual([{ blockNumber: 1n, id: "1-9000" }]);
    expect(attempts.get("9001-18000")).toBe(2);
    expect(warnSpy).toHaveBeenCalledWith(
      "Failed to load market logs for block range 9001-18000; skipping.",
      expect.any(Error),
    );

    warnSpy.mockRestore();
  });

  test("keeps bid logs decodable when market scans cross block chunks", async () => {
    const chunks: Array<{ from: bigint; to: bigint }> = [];
    const logs = await fetchLogsInBlockRange({
      chunkSize: 5n,
      fromBlock: 10n,
      getLogs: async (chunk) => {
        chunks.push(chunk);

        if (chunk.from === 10n) {
          return [
            rawLog({
              abi: bidPlacedAbi,
              args: [7n, 3n, buyer, 100n, 4n],
              blockNumber: 12n,
              logIndex: 0,
            }),
          ];
        }

        return [
          rawLog({
            abi: bidFilledAbi,
            args: [7n, 3n, buyer, seller, 2n, 200n, 1n],
            blockNumber: 16n,
            logIndex: 1,
          }),
        ];
      },
      retryCount: 0,
      toBlock: 19n,
    });

    expect(chunks).toEqual([
      { from: 10n, to: 14n },
      { from: 15n, to: 19n },
    ]);
    expect(parseMarketLogs(logs)).toMatchObject([
      { bidId: 7n, tokenId: 3n, type: "bid-placed" },
      { bidId: 7n, tokenId: 3n, totalPaid: 200n, type: "bid-filled" },
    ]);
  });
});
