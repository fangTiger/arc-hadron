import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mockState = vi.hoisted(() => ({
  address: "0x1111111111111111111111111111111111111111" as `0x${string}`,
  bidCount: 0n as bigint | undefined,
  bidIds: [] as bigint[] | undefined,
  bidResults: [] as unknown[] | undefined,
  isConnected: true,
  readContractCalls: [] as unknown[],
  readContractsCalls: [] as unknown[],
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({
    address: mockState.address,
    isConnected: mockState.isConnected,
  }),
  useReadContract: (input: unknown) => {
    mockState.readContractCalls.push(input);
    const call = input as { functionName?: string };

    if (call.functionName === "bidsByToken") {
      return { data: mockState.bidIds, isLoading: false };
    }

    if (call.functionName === "bidCount") {
      return { data: mockState.bidCount, isLoading: false };
    }

    return { data: undefined, isLoading: false };
  },
  useReadContracts: (input: unknown) => {
    mockState.readContractsCalls.push(input);

    return { data: mockState.bidResults, isLoading: false };
  },
}));

async function hooksModule() {
  return import("../lib/hooks/useBids").catch(() => null);
}

describe("useBids hooks", () => {
  beforeEach(() => {
    mockState.address = "0x1111111111111111111111111111111111111111";
    mockState.bidCount = 0n;
    mockState.bidIds = [];
    mockState.bidResults = [];
    mockState.isConnected = true;
    mockState.readContractCalls = [];
    mockState.readContractsCalls = [];
  });

  test("loads bids for one token with bidsByToken followed by getBid multicall", async () => {
    const mod = await hooksModule();

    expect(mod).not.toBeNull();
    if (!mod) {
      return;
    }

    mockState.bidIds = [9n, 3n];
    mockState.bidResults = [
      {
        active: true,
        bidder: "0x2222222222222222222222222222222222222222",
        pricePerShare: 10n,
        remaining: 2n,
        tokenId: 7n,
      },
      {
        active: true,
        bidder: mockState.address,
        pricePerShare: 12n,
        remaining: 1n,
        tokenId: 7n,
      },
    ];

    function Probe() {
      const { bids, isLoading } = mod.useBids(7n);

      return <span>{`${isLoading ? "loading" : "ready"}:${bids.map((bid) => bid.id.toString()).join(",")}`}</span>;
    }

    expect(renderToStaticMarkup(<Probe />)).toContain("ready:3,9");
    expect(mockState.readContractCalls[0]).toMatchObject({
      args: [7n],
      functionName: "bidsByToken",
    });
    expect(mockState.readContractsCalls[0]).toMatchObject({
      contracts: [
        expect.objectContaining({ args: [9n], functionName: "getBid" }),
        expect.objectContaining({ args: [3n], functionName: "getBid" }),
      ],
    });
  });

  test("loads my bids from bidCount and filters to the connected bidder", async () => {
    const mod = await hooksModule();

    expect(mod).not.toBeNull();
    if (!mod) {
      return;
    }

    mockState.bidCount = 3n;
    mockState.bidResults = [
      {
        active: true,
        bidder: mockState.address,
        pricePerShare: 8n,
        remaining: 2n,
        tokenId: 1n,
      },
      {
        active: true,
        bidder: "0x2222222222222222222222222222222222222222",
        pricePerShare: 10n,
        remaining: 2n,
        tokenId: 1n,
      },
      {
        active: true,
        bidder: mockState.address,
        pricePerShare: 12n,
        remaining: 1n,
        tokenId: 2n,
      },
    ];

    function Probe() {
      const { bids, isLoading } = mod.useMyBids();

      return <span>{`${isLoading ? "loading" : "ready"}:${bids.map((bid) => bid.id.toString()).join(",")}`}</span>;
    }

    expect(renderToStaticMarkup(<Probe />)).toContain("ready:3,1");
    expect(mockState.readContractCalls[0]).toMatchObject({ functionName: "bidCount" });
    expect(mockState.readContractsCalls[0]).toMatchObject({
      contracts: [
        expect.objectContaining({ args: [1n], functionName: "getBid" }),
        expect.objectContaining({ args: [2n], functionName: "getBid" }),
        expect.objectContaining({ args: [3n], functionName: "getBid" }),
      ],
    });
  });
});
