import { afterEach, describe, expect, test, vi } from "vitest";
import { createSlidingWindowLimiter } from "../lib/ai/rateLimit";
import { resetAiRouteLimiterForTests } from "../lib/ai/routeShared";
import { createSseFrameParser, type AiSseEvent } from "../lib/ai/sse";
import { SNAPSHOT_SCHEMA_VERSION } from "../lib/ai/snapshot";
import { maxDuration, POST, runtime } from "../app/api/ai/brief/route";
import { POST as insightPOST } from "../app/api/ai/insight/route";
import { getDeepSeekClient } from "../lib/llm/deepseek";

vi.mock("../lib/llm/deepseek", () => ({
  DEEPSEEK_MODEL: "test-deepseek-model",
  getDeepSeekClient: vi.fn(),
}));

const getDeepSeekClientMock = vi.mocked(getDeepSeekClient);

const VALID_MARKET_SNAPSHOT = {
  schemaVersion: SNAPSHOT_SCHEMA_VERSION,
  kind: "market",
  summary: {
    assetCount: 1,
    total24hVolume: "2500.00",
  },
  assets: [
    {
      tokenId: "15",
      name: "US T-BILL 2026-Q3",
      category: "treasuries",
      ticker: "TBILL",
      displayName: "US T-Bill 2026-Q3",
      issuer: "Hadron Treasury Desk",
      apyBps: 525,
      totalShares: "10000",
      offering: {
        id: "9",
        active: true,
        remaining: "5000",
        sharePrice: "1.25",
      },
      latestSharePrice: "1.30",
      change24hPct: 1.2,
      volume24h: "2500.00",
      orderBook: [{ id: "1", remaining: "250", sharePrice: "1.31" }],
    },
  ],
  recentTrades: [
    {
      amount: "200",
      blockNumber: "100",
      buyer: "0x1000000000000000000000000000000000000001",
      logIndex: 1,
      seller: "0x2000000000000000000000000000000000000002",
      sharePrice: "1.25",
      timestamp: Date.UTC(2026, 6, 3, 9),
      tokenId: "15",
      totalPaid: "250.00",
      txHash: `0x${"1".padStart(64, "0")}`,
      type: "primary-sale",
    },
  ],
};

const VALID_ASSET_SNAPSHOT = {
  schemaVersion: SNAPSHOT_SCHEMA_VERSION,
  kind: "asset",
  asset: {
    ...VALID_MARKET_SNAPSHOT.assets[0],
    description: "Short-duration Treasury exposure for the testnet catalog.",
    slug: "t-bill-2026-q3",
  },
  orderBook: VALID_MARKET_SNAPSHOT.assets[0].orderBook,
  priceSeries: [{ t: Date.UTC(2026, 6, 3, 9), sharePrice: "1.25" }],
  recentTrades: VALID_MARKET_SNAPSHOT.recentTrades,
};

function requestFor(path: "brief" | "insight", body: unknown, init: RequestInit = {}): Request {
  return new Request(`http://localhost/api/ai/${path}`, {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "198.51.100.10, 203.0.113.2",
      ...init.headers,
    },
    signal: init.signal,
  });
}

async function* streamChunks(chunks: readonly string[]) {
  for (const content of chunks) {
    yield { choices: [{ delta: { content } }] };
  }
}

function mockDeepSeekStream(chunks: readonly string[] = ["market", "brief"]) {
  const create = vi.fn(async () => streamChunks(chunks));
  getDeepSeekClientMock.mockReturnValue({
    chat: { completions: { create } },
  } as never);

  return create;
}

async function readSseEvents(response: Response): Promise<AiSseEvent[]> {
  const parser = createSseFrameParser();
  const body = await response.text();

  return parser.push(body);
}

async function readJson(response: Response) {
  return response.json() as Promise<{ error: string }>;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  resetAiRouteLimiterForTests();
});

describe("AI brief route", () => {
  test("declares Node runtime and a 60s max duration", () => {
    expect(runtime).toBe("nodejs");
    expect(maxDuration).toBe(60);
  });

  test("streams market brief chunks as typed SSE frames and uses the brief prompt", async () => {
    const create = mockDeepSeekStream(["## Movers\n", "No notable movers."]);

    const response = await POST(requestFor("brief", VALID_MARKET_SNAPSHOT));
    const events = await readSseEvents(response);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(response.headers.get("cache-control")).toBe("no-cache, no-transform");
    expect(events).toEqual([
      { type: "chunk", data: { delta: "## Movers\n" } },
      { type: "chunk", data: { delta: "No notable movers." } },
      { type: "done", data: { ok: true } },
    ]);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "test-deepseek-model",
        stream: true,
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: "system",
            content: expect.stringContaining("Movers"),
          }),
          expect.objectContaining({
            role: "user",
            content: expect.stringContaining("market snapshot JSON"),
          }),
        ]),
      }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  test("shares the process limiter with the insight route and returns 429 without upstream", async () => {
    const create = mockDeepSeekStream(["first"]);
    resetAiRouteLimiterForTests(
      createSlidingWindowLimiter({
        perIpPerMinute: 1,
        globalPerMinute: 10,
        now: () => 5_000,
      }),
    );

    await readSseEvents(await insightPOST(requestFor("insight", VALID_ASSET_SNAPSHOT)));
    const response = await POST(requestFor("brief", VALID_MARKET_SNAPSHOT));

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(await readJson(response)).toEqual({ error: "Too many requests" });
    expect(create).toHaveBeenCalledTimes(1);
  });

  test("rejects payloads over 32 KiB before market shape validation", async () => {
    mockDeepSeekStream();
    const response = await POST(requestFor("brief", JSON.stringify({ padding: "x".repeat(33 * 1024) })));

    expect(response.status).toBe(400);
    expect(await readJson(response)).toEqual({ error: "Payload too large" });
    expect(getDeepSeekClientMock).not.toHaveBeenCalled();
  });

  test("rejects malformed market snapshots with a 400 JSON error", async () => {
    mockDeepSeekStream();

    const response = await POST(
      requestFor("brief", {
        ...VALID_MARKET_SNAPSHOT,
        schemaVersion: "old",
      }),
    );

    expect(response.status).toBe(400);
    expect(await readJson(response)).toEqual({ error: "Invalid snapshot" });
    expect(getDeepSeekClientMock).not.toHaveBeenCalled();
  });

  test("returns 503 JSON before opening an SSE stream when production has no key", async () => {
    vi.stubEnv("NODE_ENV", "production");
    getDeepSeekClientMock.mockImplementation(() => {
      throw new Error("DEEPSEEK_API_KEY required in production");
    });

    const response = await POST(requestFor("brief", VALID_MARKET_SNAPSHOT));

    expect(response.status).toBe(503);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await readJson(response)).toEqual({ error: "AI is not configured" });
  });

  test("turns upstream failures into SSE error frames and closes normally", async () => {
    getDeepSeekClientMock.mockReturnValue({
      chat: {
        completions: {
          create: vi.fn(async function* () {
            yield { choices: [{ delta: { content: "partial brief" } }] };
            throw new Error("upstream unavailable");
          }),
        },
      },
    } as never);

    const response = await POST(requestFor("brief", VALID_MARKET_SNAPSHOT));
    const events = await readSseEvents(response);

    expect(response.status).toBe(200);
    expect(events).toEqual([
      { type: "chunk", data: { delta: "partial brief" } },
      { type: "error", data: { message: "Generation failed" } },
    ]);
  });

  test("aborts the upstream request when the client request is aborted", async () => {
    let upstreamSignal: AbortSignal | undefined;
    getDeepSeekClientMock.mockReturnValue({
      chat: {
        completions: {
          create: vi.fn(async (_params: unknown, options?: { signal?: AbortSignal }) => {
            upstreamSignal = options?.signal;

            return (async function* () {
              if (!upstreamSignal?.aborted) {
                await new Promise<void>((resolve) => {
                  upstreamSignal?.addEventListener("abort", () => resolve(), { once: true });
                });
              }
            })();
          }),
        },
      },
    } as never);
    const clientAbort = new AbortController();

    const response = await POST(requestFor("brief", VALID_MARKET_SNAPSHOT, { signal: clientAbort.signal }));
    clientAbort.abort();
    await response.body?.cancel();

    expect(upstreamSignal).toBeDefined();
    expect(upstreamSignal?.aborted).toBe(true);
  });
});
