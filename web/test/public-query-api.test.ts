import { describe, expect, test, vi } from "vitest";

vi.mock("@/lib/api/publicQuery", () => ({
  loadAssetsPayload: vi.fn(async () => ({
    data: [
      {
        tokenId: "1",
        name: "US T-BILL 2026-Q3",
        category: "treasuries",
        totalShares: "10000",
        meta: { ticker: "TBILL", displayName: "US T-Bill 2026-Q3" },
        offering: { id: "1", pricePerShare: "1000000000000000000", remaining: "5000" },
      },
    ],
  })),
  loadBidsPayload: vi.fn(async () => ({
    data: [
      {
        id: "2",
        bidder: "0x2222222222222222222222222222222222222222",
        tokenId: "1",
        pricePerShare: "990000000000000000",
        remaining: "300",
      },
    ],
  })),
  loadListingsPayload: vi.fn(async () => ({
    data: [
      {
        id: "1",
        seller: "0x1111111111111111111111111111111111111111",
        tokenId: "1",
        pricePerShare: "1010000000000000000",
        remaining: "200",
      },
    ],
  })),
  loadTradesPayload: vi.fn(async () => ({
    data: [
      {
        type: "purchased",
        tokenId: "1",
        txHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        logIndex: 0,
        blockNumber: "123",
      },
    ],
  })),
}));

async function readJson(response: Response): Promise<unknown> {
  return response.json();
}

describe("public read-only query API routes", () => {
  test("GET /v1/assets returns JSON asset data", async () => {
    const { GET } = await import("../app/v1/assets/route");

    const response = await GET(new Request("https://hadron.test/v1/assets"));

    expect(response.status).toBe(200);
    expect(await readJson(response)).toMatchObject({
      data: [{ tokenId: "1", meta: { ticker: "TBILL" } }],
    });
  });

  test("GET /v1/orders/listings forwards token filters and returns listings", async () => {
    const publicQuery = await import("../lib/api/publicQuery");
    const { GET } = await import("../app/v1/orders/listings/route");

    const response = await GET(new Request("https://hadron.test/v1/orders/listings?tokenId=1"));

    expect(response.status).toBe(200);
    expect(publicQuery.loadListingsPayload).toHaveBeenCalledWith({ tokenId: 1n });
    expect(await readJson(response)).toMatchObject({
      data: [{ id: "1", tokenId: "1" }],
    });
  });

  test("GET /v1/orders/bids forwards token filters and returns bids", async () => {
    const publicQuery = await import("../lib/api/publicQuery");
    const { GET } = await import("../app/v1/orders/bids/route");

    const response = await GET(new Request("https://hadron.test/v1/orders/bids?tokenId=1"));

    expect(response.status).toBe(200);
    expect(publicQuery.loadBidsPayload).toHaveBeenCalledWith({ tokenId: 1n });
    expect(await readJson(response)).toMatchObject({
      data: [{ id: "2", tokenId: "1" }],
    });
  });

  test("GET /v1/trades supports tokenId and limit filters", async () => {
    const publicQuery = await import("../lib/api/publicQuery");
    const { GET } = await import("../app/v1/trades/route");

    const response = await GET(new Request("https://hadron.test/v1/trades?tokenId=1&limit=25"));

    expect(response.status).toBe(200);
    expect(publicQuery.loadTradesPayload).toHaveBeenCalledWith({ limit: 25, tokenId: 1n });
    expect(await readJson(response)).toMatchObject({
      data: [{ type: "purchased", tokenId: "1" }],
    });
  });

  test("invalid query params return 400 JSON errors", async () => {
    const { GET } = await import("../app/v1/trades/route");

    const response = await GET(new Request("https://hadron.test/v1/trades?limit=10000"));

    expect(response.status).toBe(400);
    expect(await readJson(response)).toEqual({
      error: {
        code: "INVALID_QUERY",
        message: "limit must be an integer between 1 and 200.",
      },
    });
  });
});
