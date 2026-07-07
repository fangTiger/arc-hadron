import { afterEach, describe, expect, test, vi } from "vitest";

const tradingMock = vi.hoisted(() => ({
  broadcastSignedTransactionPayload: vi.fn(async () => ({
    data: { status: "submitted", txHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
  })),
  loadTransactionStatusPayload: vi.fn(async () => ({
    data: { status: "success", txHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
  })),
  prepareBidPayload: vi.fn(async () => ({ data: { functionName: "placeBid" } })),
  prepareBuyListingPayload: vi.fn(async () => ({ data: { functionName: "buy" } })),
  prepareCancelPayload: vi.fn(async () => ({ data: { functionName: "cancel" } })),
  prepareFillBidPayload: vi.fn(async () => ({ data: { functionName: "fillBid" } })),
  prepareListingPayload: vi.fn(async () => ({ data: { functionName: "list" } })),
}));

vi.mock("@/lib/api/trading", () => {
  class TradingInputError extends Error {}

  return {
    TradingInputError,
    ...tradingMock,
  };
});

const ORIGINAL_KEYS = process.env.HADRON_API_KEYS;

function postRequest(path: string, body: unknown, apiKey = "alpha"): Request {
  return new Request(`https://hadron.test${path}`, {
    body: JSON.stringify(body),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });
}

async function readJson(response: Response): Promise<unknown> {
  return response.json();
}

describe("trading API route handlers", () => {
  afterEach(() => {
    if (ORIGINAL_KEYS === undefined) {
      delete process.env.HADRON_API_KEYS;
    } else {
      process.env.HADRON_API_KEYS = ORIGINAL_KEYS;
    }
    vi.clearAllMocks();
  });

  test("rejects trading requests without a team-issued API key", async () => {
    process.env.HADRON_API_KEYS = "alpha,beta";
    const { POST } = await import("../app/v1/orders/listings/prepare/route");

    const response = await POST(
      new Request("https://hadron.test/v1/orders/listings/prepare", { method: "POST" }),
    );

    expect(response.status).toBe(401);
    expect(tradingMock.prepareListingPayload).not.toHaveBeenCalled();
    expect(await readJson(response)).toEqual({
      error: {
        code: "INVALID_API_KEY",
        message: "Missing or invalid team-issued HADRON API key.",
      },
    });
  });

  test("prepares listing and bid orders for authenticated partners", async () => {
    process.env.HADRON_API_KEYS = "alpha,beta";
    const listingRoute = await import("../app/v1/orders/listings/prepare/route");
    const bidRoute = await import("../app/v1/orders/bids/prepare/route");

    const listingResponse = await listingRoute.POST(
      postRequest("/v1/orders/listings/prepare", {
        amount: "10",
        pricePerShare: "120",
        tokenId: "1",
      }),
    );
    const bidResponse = await bidRoute.POST(
      postRequest("/v1/orders/bids/prepare", {
        amount: "2",
        pricePerShare: "50",
        tokenId: "1",
      }),
    );

    expect(listingResponse.status).toBe(200);
    expect(bidResponse.status).toBe(200);
    expect(tradingMock.prepareListingPayload).toHaveBeenCalledWith({
      amount: "10",
      pricePerShare: "120",
      tokenId: "1",
    });
    expect(tradingMock.prepareBidPayload).toHaveBeenCalledWith({
      amount: "2",
      pricePerShare: "50",
      tokenId: "1",
    });
  });

  test("prepares buy, fill, and cancel operations with path parameters", async () => {
    process.env.HADRON_API_KEYS = "alpha,beta";
    const buyRoute = await import("../app/v1/orders/listings/[listingId]/buy/prepare/route");
    const fillRoute = await import("../app/v1/orders/bids/[bidId]/fill/prepare/route");
    const cancelRoute = await import("../app/v1/orders/cancel/prepare/route");

    await buyRoute.POST(postRequest("/v1/orders/listings/4/buy/prepare", { amount: "2" }), {
      params: Promise.resolve({ listingId: "4" }),
    });
    await fillRoute.POST(postRequest("/v1/orders/bids/6/fill/prepare", { amount: "3" }), {
      params: Promise.resolve({ bidId: "6" }),
    });
    await cancelRoute.POST(
      postRequest("/v1/orders/cancel/prepare", { orderId: "6", orderType: "bid" }),
    );

    expect(tradingMock.prepareBuyListingPayload).toHaveBeenCalledWith({
      body: { amount: "2" },
      listingId: "4",
    });
    expect(tradingMock.prepareFillBidPayload).toHaveBeenCalledWith({
      bidId: "6",
      body: { amount: "3" },
    });
    expect(tradingMock.prepareCancelPayload).toHaveBeenCalledWith({
      orderId: "6",
      orderType: "bid",
    });
  });

  test("broadcasts signed transactions and reads transaction status", async () => {
    process.env.HADRON_API_KEYS = "alpha,beta";
    const broadcastRoute = await import("../app/v1/trades/broadcast/route");
    const statusRoute = await import("../app/v1/transactions/[txHash]/route");
    const txHash = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    const broadcastResponse = await broadcastRoute.POST(
      postRequest("/v1/trades/broadcast", { signedTx: "0x02f8aa" }),
    );
    const statusResponse = await statusRoute.GET(
      new Request(`https://hadron.test/v1/transactions/${txHash}`, {
        headers: { Authorization: "Bearer alpha" },
      }),
      { params: Promise.resolve({ txHash }) },
    );

    expect(broadcastResponse.status).toBe(200);
    expect(statusResponse.status).toBe(200);
    expect(tradingMock.broadcastSignedTransactionPayload).toHaveBeenCalledWith({
      signedTx: "0x02f8aa",
    });
    expect(tradingMock.loadTransactionStatusPayload).toHaveBeenCalledWith({ txHash });
  });

  test("maps malformed trading payloads to INVALID_ORDER", async () => {
    process.env.HADRON_API_KEYS = "alpha,beta";
    const trading = await import("../lib/api/trading");
    tradingMock.prepareListingPayload.mockRejectedValueOnce(
      new trading.TradingInputError("amount must be a positive integer string."),
    );
    const { POST } = await import("../app/v1/orders/listings/prepare/route");

    const response = await POST(
      postRequest("/v1/orders/listings/prepare", {
        amount: "0",
        pricePerShare: "120",
        tokenId: "1",
      }),
    );

    expect(response.status).toBe(400);
    expect(await readJson(response)).toEqual({
      error: {
        code: "INVALID_ORDER",
        message: "amount must be a positive integer string.",
      },
    });
  });
});
