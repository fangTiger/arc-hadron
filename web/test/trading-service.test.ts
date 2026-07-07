import { decodeFunctionData, type Address, type Hex } from "viem";
import { describe, expect, test, vi } from "vitest";
import { HADRON_MARKET_ABI, HADRON_MARKET_ADDRESS } from "../lib/contracts";
import type { PublicQueryClient } from "../lib/api/publicQuery";
import {
  broadcastSignedTransactionPayload,
  loadTransactionStatusPayload,
  prepareBidPayload,
  prepareBuyListingPayload,
  prepareCancelPayload,
  prepareFillBidPayload,
  prepareListingPayload,
  TradingInputError,
  type TradingApiClient,
} from "../lib/api/trading";

const SELLER = "0x1111111111111111111111111111111111111111" as Address;
const BIDDER = "0x2222222222222222222222222222222222222222" as Address;
const TX_HASH = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Hex;
const SIGNED_TX = "0x02f8aa" as Hex;

function baseClient(): PublicQueryClient {
  return {
    async getBlock() {
      return { timestamp: 1n };
    },
    async getBlockNumber() {
      return 1n;
    },
    async getLogs() {
      return [];
    },
    async readContract() {
      throw new Error("Unexpected read");
    },
  };
}

function tradingClient(): TradingApiClient {
  return {
    ...baseClient(),
    async readContract({ functionName }) {
      if (functionName === "getListing") {
        return [SELLER, 1n, 120n, 10n, true];
      }

      if (functionName === "getBid") {
        return [BIDDER, 1n, 110n, 8n, true];
      }

      throw new Error(`Unexpected read: ${String(functionName)}`);
    },
    getTransactionReceipt: vi.fn(async () => ({
      blockNumber: 123n,
      from: BIDDER,
      gasUsed: 21000n,
      status: "success",
      to: HADRON_MARKET_ADDRESS,
      transactionHash: TX_HASH,
    })),
    sendRawTransaction: vi.fn(async () => TX_HASH),
  };
}

function decode(calldata: Hex) {
  return decodeFunctionData({
    abi: HADRON_MARKET_ABI,
    data: calldata,
  });
}

describe("trading API service", () => {
  test("prepares a sell listing with HadronMarket calldata", async () => {
    const payload = await prepareListingPayload({
      amount: "10",
      pricePerShare: "120",
      tokenId: "1",
    });

    expect(payload.data).toMatchObject({
      approvalRequired: true,
      args: { amount: "10", pricePerShare: "120", tokenId: "1" },
      chainId: 5042002,
      functionName: "list",
      to: HADRON_MARKET_ADDRESS,
      value: "0",
    });
    expect(decode(payload.data.calldata)).toMatchObject({
      args: [1n, 10n, 120n],
      functionName: "list",
    });
  });

  test("prepares a buy bid with payable escrow value", async () => {
    const payload = await prepareBidPayload({
      amount: "25",
      pricePerShare: "12",
      tokenId: "7",
    });

    expect(payload.data.value).toBe("300");
    expect(decode(payload.data.calldata)).toMatchObject({
      args: [7n, 25n, 12n],
      functionName: "placeBid",
    });
  });

  test("prepares listing purchase and rejects amounts beyond remaining shares", async () => {
    const client = tradingClient();
    const payload = await prepareBuyListingPayload({
      body: { amount: "2" },
      client,
      listingId: "4",
    });

    expect(payload.data).toMatchObject({
      args: { amount: "2", listingId: "4" },
      functionName: "buy",
      pricePerShare: "120",
      tokenId: "1",
      value: "240",
    });
    expect(decode(payload.data.calldata)).toMatchObject({
      args: [4n, 2n],
      functionName: "buy",
    });

    await expect(
      prepareBuyListingPayload({ body: { amount: "11" }, client, listingId: "4" }),
    ).rejects.toThrow(TradingInputError);
  });

  test("prepares bid fill and cancel calldata", async () => {
    const client = tradingClient();
    const fill = await prepareFillBidPayload({
      bidId: "6",
      body: { amount: "3" },
      client,
    });
    const cancel = await prepareCancelPayload({ orderId: "6", orderType: "bid" });

    expect(fill.data).toMatchObject({
      approvalRequired: true,
      functionName: "fillBid",
      pricePerShare: "110",
      value: "0",
    });
    expect(decode(fill.data.calldata)).toMatchObject({
      args: [6n, 3n],
      functionName: "fillBid",
    });
    expect(decode(cancel.data.calldata)).toMatchObject({
      args: [6n],
      functionName: "cancelBid",
    });
  });

  test("broadcasts signed raw transactions and exposes transaction status", async () => {
    const client = tradingClient();
    const broadcast = await broadcastSignedTransactionPayload(
      { idempotencyKey: "desk-1", signedTx: SIGNED_TX },
      { client },
    );
    const status = await loadTransactionStatusPayload({ client, txHash: TX_HASH });

    expect(client.sendRawTransaction).toHaveBeenCalledWith({ serializedTransaction: SIGNED_TX });
    expect(broadcast.data).toMatchObject({
      idempotencyKey: "desk-1",
      status: "submitted",
      txHash: TX_HASH,
    });
    expect(status.data).toMatchObject({
      blockNumber: "123",
      gasUsed: "21000",
      status: "success",
      txHash: TX_HASH,
    });
  });
});
