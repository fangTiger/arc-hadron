import { afterEach, describe, expect, test, vi } from "vitest";
import { createSseFrameParser, type AiSseEvent } from "../lib/ai/sse";
import { SNAPSHOT_SCHEMA_VERSION } from "../lib/ai/snapshot";
import { createSlidingWindowLimiter } from "../lib/ai/rateLimit";
import { resetAiRouteLimiterForTests } from "../lib/ai/routeShared";
import { getDeepSeekClient } from "../lib/llm/deepseek";
import { maxDuration, POST, runtime } from "../app/api/ai/insight/route";

vi.mock("../lib/llm/deepseek", () => ({
  DEEPSEEK_MODEL: "test-deepseek-model",
  getDeepSeekClient: vi.fn(),
}));

const getDeepSeekClientMock = vi.mocked(getDeepSeekClient);

const VALID_ASSET_SNAPSHOT = {
  schemaVersion: SNAPSHOT_SCHEMA_VERSION,
  kind: "asset",
  asset: {
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
    description: "Short-duration Treasury exposure for the testnet catalog.",
    slug: "t-bill-2026-q3",
  },
  orderBook: [{ id: "1", remaining: "250", sharePrice: "1.31" }],
  priceSeries: [{ t: Date.UTC(2026, 6, 3, 9), sharePrice: "1.25" }],
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

function requestFor(body: unknown, init: RequestInit = {}): Request {
  return new Request("http://localhost/api/ai/insight", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.9, 198.51.100.1",
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

function mockDeepSeekStream(chunks: readonly string[] = ["alpha", "beta"]) {
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
  vi.useRealTimers();
  vi.clearAllMocks();
  resetAiRouteLimiterForTests();
});

describe("AI insight route", () => {
  test("declares Node runtime and a 60s max duration", () => {
    expect(runtime).toBe("nodejs");
    expect(maxDuration).toBe(60);
  });

  test("streams DeepSeek chunks as typed SSE frames and finishes with done", async () => {
    const create = mockDeepSeekStream(["## Outlook\n", "Liquidity is thin."]);

    const response = await POST(requestFor(VALID_ASSET_SNAPSHOT));
    const events = await readSseEvents(response);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(response.headers.get("cache-control")).toBe("no-cache, no-transform");
    expect(events).toEqual([
      { type: "chunk", data: { delta: "## Outlook\n" } },
      { type: "chunk", data: { delta: "Liquidity is thin." } },
      { type: "done", data: { ok: true } },
    ]);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "test-deepseek-model",
        stream: true,
        messages: expect.arrayContaining([
          expect.objectContaining({ role: "system" }),
          expect.objectContaining({ role: "user" }),
        ]),
      }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  test("returns 429 with Retry-After before reading the body when the IP is limited", async () => {
    const create = mockDeepSeekStream(["first"]);
    resetAiRouteLimiterForTests(
      createSlidingWindowLimiter({
        perIpPerMinute: 1,
        globalPerMinute: 10,
        now: () => 1_000,
      }),
    );

    await readSseEvents(await POST(requestFor(VALID_ASSET_SNAPSHOT)));
    const response = await POST(requestFor(VALID_ASSET_SNAPSHOT));

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(await readJson(response)).toEqual({ error: "Too many requests" });
    expect(create).toHaveBeenCalledTimes(1);
  });

  test("rejects payloads over 32 KiB before JSON shape validation", async () => {
    mockDeepSeekStream();
    const body = JSON.stringify({ padding: "x".repeat(33 * 1024) });

    const response = await POST(requestFor(body));

    expect(response.status).toBe(400);
    expect(await readJson(response)).toEqual({ error: "Payload too large" });
    expect(getDeepSeekClientMock).not.toHaveBeenCalled();
  });

  test("rejects malformed asset snapshots with a 400 JSON error", async () => {
    mockDeepSeekStream();

    const response = await POST(
      requestFor({
        ...VALID_ASSET_SNAPSHOT,
        kind: "market",
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

    const response = await POST(requestFor(VALID_ASSET_SNAPSHOT));

    expect(response.status).toBe(503);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await readJson(response)).toEqual({ error: "AI is not configured" });
  });

  test("turns upstream failures into SSE error frames and closes normally", async () => {
    getDeepSeekClientMock.mockReturnValue({
      chat: {
        completions: {
          create: vi.fn(async function* () {
            yield { choices: [{ delta: { content: "partial" } }] };
            throw new Error("upstream unavailable");
          }),
        },
      },
    } as never);

    const response = await POST(requestFor(VALID_ASSET_SNAPSHOT));
    const events = await readSseEvents(response);

    expect(response.status).toBe(200);
    expect(events).toEqual([
      { type: "chunk", data: { delta: "partial" } },
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
            return streamChunks(["slow"]);
          }),
        },
      },
    } as never);
    const clientAbort = new AbortController();

    const response = await POST(requestFor(VALID_ASSET_SNAPSHOT, { signal: clientAbort.signal }));
    clientAbort.abort();
    await response.body?.cancel();

    expect(upstreamSignal).toBeDefined();
    expect(upstreamSignal?.aborted).toBe(true);
  });
});
