import { describe, expect, test } from "vitest";
import {
  encodeAbiParameters,
  encodeEventTopics,
  parseAbiItem,
  type AbiEvent,
  type AbiParameter,
  type Hex,
} from "viem";
import {
  buildPriceSeries,
  compute24h,
  dedupeEvents,
  parseMarketLogs,
  type TradeEvent,
} from "../lib/events";

const primarySaleAbi = parseAbiItem(
  "event PrimarySale(uint256 indexed offeringId, uint256 indexed tokenId, address indexed buyer, uint256 amount, uint256 totalPaid, uint256 fee)",
) as AbiEvent;
const purchasedAbi = parseAbiItem(
  "event Purchased(uint256 indexed listingId, uint256 indexed tokenId, address indexed buyer, address seller, uint256 amount, uint256 totalPaid, uint256 fee)",
) as AbiEvent;
const listedAbi = parseAbiItem(
  "event Listed(uint256 indexed listingId, uint256 indexed tokenId, address indexed seller, uint256 pricePerShare, uint256 amount)",
) as AbiEvent;
const cancelledAbi = parseAbiItem(
  "event Cancelled(uint256 indexed listingId, uint256 returnedAmount)",
) as AbiEvent;
const assetIssuedAbi = parseAbiItem(
  "event AssetIssued(uint256 indexed tokenId, string name, string category, uint256 totalShares)",
) as AbiEvent;
const offeringCreatedAbi = parseAbiItem(
  "event OfferingCreated(uint256 indexed offeringId, uint256 indexed tokenId, uint256 pricePerShare, uint256 amount)",
) as AbiEvent;

const buyer = "0x1000000000000000000000000000000000000001";
const seller = "0x2000000000000000000000000000000000000002";

function hash(index: number): Hex {
  return `0x${index.toString(16).padStart(64, "0")}`;
}

function rawLog({
  abi,
  args,
  blockNumber = 100n,
  logIndex,
  txHash = hash(logIndex + 1),
}: {
  abi: AbiEvent;
  args: readonly unknown[];
  blockNumber?: bigint;
  logIndex: number;
  txHash?: Hex;
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
    transactionHash: txHash,
  };
}

function event(overrides: Partial<TradeEvent>): TradeEvent {
  return {
    blockNumber: 1n,
    logIndex: 0,
    tokenId: 1n,
    txHash: hash(1),
    type: "primary-sale",
    ...overrides,
  };
}

describe("parseMarketLogs", () => {
  test("parses PrimarySale logs and derives price per share from total paid", () => {
    const [parsed] = parseMarketLogs([
      rawLog({
        abi: primarySaleAbi,
        args: [9n, 4n, buyer, 3n, 555n, 5n],
        logIndex: 2,
      }),
    ]);

    expect(parsed).toMatchObject({
      amount: 3n,
      blockNumber: 100n,
      logIndex: 2,
      pricePerShare: 185n,
      tokenId: 4n,
      totalPaid: 555n,
      txHash: hash(3),
      type: "primary-sale",
    });
  });

  test("parses Purchased logs with secondary trade totals", () => {
    const [parsed] = parseMarketLogs([
      rawLog({
        abi: purchasedAbi,
        args: [11n, 2n, buyer, seller, 5n, 1250n, 12n],
        logIndex: 0,
      }),
    ]);

    expect(parsed).toMatchObject({
      amount: 5n,
      pricePerShare: 250n,
      tokenId: 2n,
      totalPaid: 1250n,
      type: "purchased",
    });
  });

  test("parses Listed and OfferingCreated logs with explicit price and amount", () => {
    const parsed = parseMarketLogs([
      rawLog({
        abi: listedAbi,
        args: [7n, 3n, seller, 420n, 12n],
        logIndex: 0,
      }),
      rawLog({
        abi: offeringCreatedAbi,
        args: [8n, 3n, 400n, 20n],
        logIndex: 1,
      }),
    ]);

    expect(parsed).toMatchObject([
      { amount: 12n, pricePerShare: 420n, tokenId: 3n, type: "listed" },
      { amount: 20n, pricePerShare: 400n, tokenId: 3n, type: "offering-created" },
    ]);
  });

  test("parses AssetIssued logs and treats total shares as the event amount", () => {
    const [parsed] = parseMarketLogs([
      rawLog({
        abi: assetIssuedAbi,
        args: [14n, "Nexus Invoice Pool", "invoice-financing", 12_000n],
        logIndex: 0,
      }),
    ]);

    expect(parsed).toMatchObject({
      amount: 12_000n,
      tokenId: 14n,
      type: "asset-issued",
    });
  });

  test("infers Cancelled tokenId from the matching Listed event", () => {
    const parsed = parseMarketLogs([
      rawLog({
        abi: listedAbi,
        args: [99n, 6n, seller, 50n, 30n],
        logIndex: 0,
      }),
      rawLog({
        abi: cancelledAbi,
        args: [99n, 18n],
        logIndex: 1,
      }),
    ]);

    expect(parsed[1]).toMatchObject({
      amount: 18n,
      tokenId: 6n,
      type: "cancelled",
    });
  });
});

describe("dedupeEvents", () => {
  test("keeps the first event for each transaction hash and log index pair", () => {
    const first = event({ amount: 1n, logIndex: 4, txHash: hash(88) });
    const duplicate = event({ amount: 2n, logIndex: 4, txHash: hash(88) });
    const distinct = event({ amount: 3n, logIndex: 5, txHash: hash(88) });

    expect(dedupeEvents([first, duplicate, distinct])).toEqual([first, distinct]);
  });
});

describe("buildPriceSeries", () => {
  test("returns a fallback flat line when there are fewer than two trades", () => {
    expect(buildPriceSeries([], 1n, 100n)).toEqual([
      { price: 100n, t: 0 },
      { price: 100n, t: 1 },
    ]);
    expect(
      buildPriceSeries(
        [event({ pricePerShare: 110n, timestamp: 1_000 })],
        1n,
        100n,
      ),
    ).toEqual([
      { price: 100n, t: 0 },
      { price: 100n, t: 1 },
    ]);
  });

  test("returns sorted trade prices for the requested asset only", () => {
    expect(
      buildPriceSeries(
        [
          event({ pricePerShare: 120n, timestamp: 2_000 }),
          event({ pricePerShare: 999n, timestamp: 1_500, tokenId: 2n }),
          event({ pricePerShare: 100n, timestamp: 1_000 }),
        ],
        1n,
        90n,
      ),
    ).toEqual([
      { price: 100n, t: 1_000 },
      { price: 120n, t: 2_000 },
    ]);
  });
});

describe("compute24h", () => {
  test("compares the last pre-window trade with the latest trade and sums recent volume", () => {
    const nowMs = 200_000_000;
    const cutoff = nowMs - 24 * 60 * 60 * 1000;

    const result = compute24h(
      [
        event({ pricePerShare: 100n, timestamp: cutoff - 1, totalPaid: 100n }),
        event({ pricePerShare: 120n, timestamp: cutoff + 1, totalPaid: 240n }),
        event({ pricePerShare: 130n, timestamp: nowMs - 1, totalPaid: 130n, type: "purchased" }),
        event({ pricePerShare: 999n, timestamp: nowMs - 1, tokenId: 2n, totalPaid: 999n }),
      ],
      1n,
      90n,
      nowMs,
    );

    expect(result.volume).toBe(370n);
    expect(result.changePct).toBeCloseTo(30);
  });

  test("returns zero change and zero volume when an asset has no trades", () => {
    expect(compute24h([], 1n, 100n, Date.now())).toEqual({
      changePct: 0,
      volume: 0n,
    });
  });
});
