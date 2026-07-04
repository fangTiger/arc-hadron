import { afterEach, describe, expect, test, vi } from "vitest";
import { createSlidingWindowLimiter } from "../lib/ai/rateLimit";

function requestFor(body: unknown, init: RequestInit = {}): Request {
  return new Request("http://localhost/api/ai/intent", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.20, 198.51.100.1",
      ...init.headers,
    },
    signal: init.signal,
  });
}

async function readJson(response: Response): Promise<unknown> {
  return response.json();
}

function completionFor(content: unknown) {
  return {
    choices: [
      {
        message: {
          content: typeof content === "string" ? content : JSON.stringify(content),
        },
      },
    ],
  };
}

async function loadRouteWithDeepSeekCreate(create: ReturnType<typeof vi.fn>) {
  vi.doMock("../lib/llm/deepseek", () => ({
    DEEPSEEK_MODEL: "test-deepseek-model",
    getDeepSeekClient: vi.fn(() => ({
      chat: {
        completions: { create },
      },
    })),
  }));

  const route = await import("../app/api/ai/intent/route");
  const routeShared = await import("../lib/ai/routeShared");

  return { ...route, ...routeShared };
}

async function loadRouteWithRealDeepSeek() {
  vi.doUnmock("../lib/llm/deepseek");

  const route = await import("../app/api/ai/intent/route");
  const routeShared = await import("../lib/ai/routeShared");

  return { ...route, ...routeShared };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.clearAllMocks();
});

describe("AI intent route", () => {
  test("declares Node runtime and returns normalized JSON intent from DeepSeek JSON mode", async () => {
    const create = vi.fn(async () => completionFor({ kind: "query_price", asset: "HADRON" }));
    const { POST, runtime, maxDuration } = await loadRouteWithDeepSeekCreate(create);

    const response = await POST(requestFor({ message: "lowest ask for HADRON" }));

    expect(runtime).toBe("nodejs");
    expect(maxDuration).toBe(60);
    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({ kind: "query_price", asset: "HADRON" });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "test-deepseek-model",
        response_format: { type: "json_object" },
        stream: false,
        messages: expect.arrayContaining([
          expect.objectContaining({ role: "system" }),
          expect.objectContaining({ role: "user" }),
        ]),
      }),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  test("returns 429 before calling DeepSeek when the shared limiter rejects the IP", async () => {
    const create = vi.fn(async () => completionFor({ kind: "query_yield" }));
    const { POST, resetAiRouteLimiterForTests } = await loadRouteWithDeepSeekCreate(create);

    resetAiRouteLimiterForTests(
      createSlidingWindowLimiter({
        perIpPerMinute: 1,
        globalPerMinute: 10,
        now: () => 10_000,
      }),
    );

    await POST(requestFor({ message: "yield" }));
    const response = await POST(requestFor({ message: "yield" }));

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(await readJson(response)).toEqual({ error: "Too many requests" });
    expect(create).toHaveBeenCalledTimes(1);
  });

  test("rejects payloads over 32 KiB before shape validation", async () => {
    const create = vi.fn(async () => completionFor({ kind: "query_yield" }));
    const { POST } = await loadRouteWithDeepSeekCreate(create);
    const response = await POST(requestFor(JSON.stringify({ padding: "x".repeat(33 * 1024) })));

    expect(response.status).toBe(400);
    expect(await readJson(response)).toEqual({ error: "Payload too large" });
    expect(create).not.toHaveBeenCalled();
  });

  test("rejects malformed intent requests with a 400 JSON error", async () => {
    const create = vi.fn(async () => completionFor({ kind: "query_yield" }));
    const { POST } = await loadRouteWithDeepSeekCreate(create);

    for (const body of [{ prompt: "buy 1 HADRON" }, { message: "" }, { message: "x".repeat(2049) }]) {
      const response = await POST(requestFor(body));

      expect(response.status).toBe(400);
      expect(await readJson(response)).toEqual({ error: "Invalid intent request" });
    }

    expect(create).not.toHaveBeenCalled();
  });

  test("uses the no-key development mock without making an external request", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    vi.stubEnv("NODE_ENV", "test");
    const { POST } = await loadRouteWithRealDeepSeek();

    const response = await POST(requestFor({ message: "buy 2.5 HADRON" }));

    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({ kind: "buy", asset: "HADRON", quantity: 2.5 });
  });

  test("returns 503 JSON when production has no DeepSeek key", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    vi.stubEnv("NODE_ENV", "production");
    const { POST } = await loadRouteWithRealDeepSeek();

    const response = await POST(requestFor({ message: "yield" }));

    expect(response.status).toBe(503);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await readJson(response)).toEqual({ error: "AI is not configured" });
  });
});
