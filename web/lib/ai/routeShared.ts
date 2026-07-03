import { buildBriefPrompt, buildInsightPrompt, type AiPrompt } from "@/lib/ai/prompts";
import { createSlidingWindowLimiter, type SlidingWindowLimiter } from "@/lib/ai/rateLimit";
import { encodeSseEvent } from "@/lib/ai/sse";
import { SNAPSHOT_SCHEMA_VERSION, type AssetSnapshot, type MarketSnapshot } from "@/lib/ai/snapshot";
import { DEEPSEEK_MODEL, getDeepSeekClient } from "@/lib/llm/deepseek";

const RAW_BODY_LIMIT_BYTES = 32 * 1024;
const UPSTREAM_TIMEOUT_MS = 55_000;
export const DEFAULT_AI_ROUTE_PER_IP_PER_MINUTE = 12;
export const DEFAULT_AI_ROUTE_GLOBAL_PER_MINUTE = 60;

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
};

type ChatMessage = {
  role: "system" | "user";
  content: string;
};

type DeepSeekStreamChunk = {
  choices?: Array<{
    delta?: {
      content?: string;
    };
  }>;
};

type DeepSeekStreamClient = {
  chat: {
    completions: {
      create: (
        params: {
          model: string;
          messages: ChatMessage[];
          stream: true;
        },
        options: { signal: AbortSignal },
      ) => Promise<AsyncIterable<DeepSeekStreamChunk>>;
    };
  };
};

export type SnapshotShapeGuard<T> = (snapshot: unknown) => snapshot is T;

export interface AiRouteHandlerOptions<T> {
  buildPrompt: (snapshot: T) => AiPrompt;
  limiter?: SlidingWindowLimiter;
  validateSnapshot: SnapshotShapeGuard<T>;
}

function createDefaultLimiter(): SlidingWindowLimiter {
  return createSlidingWindowLimiter({
    perIpPerMinute: DEFAULT_AI_ROUTE_PER_IP_PER_MINUTE,
    globalPerMinute: DEFAULT_AI_ROUTE_GLOBAL_PER_MINUTE,
  });
}

let sharedLimiter = createDefaultLimiter();

export function resetAiRouteLimiterForTests(limiter: SlidingWindowLimiter = createDefaultLimiter()) {
  sharedLimiter = limiter;
}

function activeLimiter(override?: SlidingWindowLimiter): SlidingWindowLimiter {
  return override ?? sharedLimiter;
}

function jsonError(message: string, status: number, headers?: HeadersInit): Response {
  return Response.json({ error: message }, { status, headers });
}

function clientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const firstForwardedIp = forwardedFor?.split(",")[0]?.trim();

  return firstForwardedIp || "unknown";
}

async function readRawBody(request: Request): Promise<{ ok: true; text: string } | { ok: false }> {
  const bytes = await request.arrayBuffer();

  if (bytes.byteLength > RAW_BODY_LIMIT_BYTES) {
    return { ok: false };
  }

  return {
    ok: true,
    text: new TextDecoder().decode(bytes),
  };
}

function parseJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function createMessages(prompt: AiPrompt): ChatMessage[] {
  return [
    { role: "system", content: prompt.system },
    { role: "user", content: prompt.user },
  ];
}

function enqueueText(controller: ReadableStreamDefaultController<Uint8Array>, text: string) {
  controller.enqueue(new TextEncoder().encode(text));
}

function abortErrorMessage(timedOut: boolean): string {
  return timedOut ? "Generation timed out" : "Generation failed";
}

function isNoKeyError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("DEEPSEEK_API_KEY");
}

function createSseResponse(prompt: AiPrompt, requestSignal: AbortSignal): Response {
  let client: DeepSeekStreamClient;

  try {
    client = getDeepSeekClient() as DeepSeekStreamClient;
  } catch (error) {
    if (isNoKeyError(error)) {
      return jsonError("AI is not configured", 503);
    }

    return jsonError("AI is not configured", 503);
  }

  const upstreamAbort = new AbortController();
  let clientAborted = requestSignal.aborted;
  let timedOut = false;

  if (clientAborted) {
    upstreamAbort.abort();
  }

  const abortUpstream = () => {
    clientAborted = true;
    upstreamAbort.abort();
  };

  requestSignal.addEventListener("abort", abortUpstream, { once: true });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const timeout = setTimeout(() => {
        timedOut = true;
        upstreamAbort.abort();
      }, UPSTREAM_TIMEOUT_MS);

      try {
        const completionStream = await client.chat.completions.create(
          {
            model: DEEPSEEK_MODEL,
            messages: createMessages(prompt),
            stream: true,
          },
          { signal: upstreamAbort.signal },
        );

        for await (const chunk of completionStream) {
          const delta = chunk.choices?.[0]?.delta?.content;

          if (delta) {
            enqueueText(controller, encodeSseEvent("chunk", { delta }));
          }
        }

        if (!clientAborted && !timedOut) {
          enqueueText(controller, encodeSseEvent("done", { ok: true }));
        } else if (!clientAborted && timedOut) {
          enqueueText(controller, encodeSseEvent("error", { message: abortErrorMessage(timedOut) }));
        }
      } catch {
        if (!clientAborted) {
          enqueueText(controller, encodeSseEvent("error", { message: abortErrorMessage(timedOut) }));
        }
      } finally {
        clearTimeout(timeout);
        requestSignal.removeEventListener("abort", abortUpstream);
        controller.close();
      }
    },
    cancel() {
      clientAborted = true;
      upstreamAbort.abort();
      requestSignal.removeEventListener("abort", abortUpstream);
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}

export function createAiRouteHandler<T>({
  buildPrompt,
  limiter,
  validateSnapshot,
}: AiRouteHandlerOptions<T>) {
  return async function POST(request: Request): Promise<Response> {
    const rateLimit = activeLimiter(limiter).check(clientIp(request));

    if (!rateLimit.allowed) {
      return jsonError("Too many requests", 429, {
        "Retry-After": String(rateLimit.retryAfterSeconds ?? 60),
      });
    }

    const rawBody = await readRawBody(request);

    if (!rawBody.ok) {
      return jsonError("Payload too large", 400);
    }

    const snapshot = parseJson(rawBody.text);

    if (!validateSnapshot(snapshot)) {
      return jsonError("Invalid snapshot", 400);
    }

    return createSseResponse(buildPrompt(snapshot), request.signal);
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown, maxLength = 4096): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength;
}

function isOptionalString(value: unknown, maxLength = 4096): value is string | null {
  return value === null || isNonEmptyString(value, maxLength);
}

function isUnsignedIntegerString(value: unknown): value is string {
  return typeof value === "string" && /^(0|[1-9]\d*)$/.test(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNullableFiniteNumber(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value);
}

function hasCommonAssetCore(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isUnsignedIntegerString(value.tokenId) &&
    isNonEmptyString(value.name, 256) &&
    isNonEmptyString(value.category, 128) &&
    isNonEmptyString(value.ticker, 32) &&
    isNonEmptyString(value.displayName, 256) &&
    isNonEmptyString(value.issuer, 256) &&
    (value.apyBps === null || Number.isInteger(value.apyBps)) &&
    isUnsignedIntegerString(value.totalShares) &&
    isOfferingShape(value.offering) &&
    isNonEmptyString(value.latestSharePrice, 64) &&
    isFiniteNumber(value.change24hPct) &&
    isNonEmptyString(value.volume24h, 64)
  );
}

function isOfferingShape(value: unknown): boolean {
  if (value === null) {
    return true;
  }

  if (!isRecord(value)) {
    return false;
  }

  return (
    isUnsignedIntegerString(value.id) &&
    typeof value.active === "boolean" &&
    isUnsignedIntegerString(value.remaining) &&
    isNonEmptyString(value.sharePrice, 64)
  );
}

function isOrderBookEntry(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isUnsignedIntegerString(value.id) &&
    isUnsignedIntegerString(value.remaining) &&
    isNonEmptyString(value.sharePrice, 64)
  );
}

function isPricePoint(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return isFiniteNumber(value.t) && isNonEmptyString(value.sharePrice, 64);
}

function isTrade(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isOptionalString(value.amount, 128) &&
    isUnsignedIntegerString(value.blockNumber) &&
    isOptionalString(value.buyer, 128) &&
    Number.isInteger(value.logIndex) &&
    isOptionalString(value.seller, 128) &&
    isOptionalString(value.sharePrice, 64) &&
    isNullableFiniteNumber(value.timestamp) &&
    isUnsignedIntegerString(value.tokenId) &&
    isOptionalString(value.totalPaid, 64) &&
    isNonEmptyString(value.txHash, 128) &&
    isNonEmptyString(value.type, 64)
  );
}

function isBoundedArray(
  value: unknown,
  maxLength: number,
  itemGuard: (item: unknown) => boolean,
): boolean {
  return Array.isArray(value) && value.length <= maxLength && value.every((item) => itemGuard(item));
}

export function isAssetSnapshotShape(snapshot: unknown): snapshot is AssetSnapshot {
  if (!isRecord(snapshot) || snapshot.schemaVersion !== SNAPSHOT_SCHEMA_VERSION) {
    return false;
  }

  if (snapshot.kind !== "asset" || !hasCommonAssetCore(snapshot.asset)) {
    return false;
  }

  const asset = snapshot.asset;

  return (
    isRecord(asset) &&
    isNonEmptyString(asset.description, 4096) &&
    isNonEmptyString(asset.slug, 256) &&
    isBoundedArray(snapshot.orderBook, 10, isOrderBookEntry) &&
    isBoundedArray(snapshot.priceSeries, 500, isPricePoint) &&
    isBoundedArray(snapshot.recentTrades, 20, isTrade)
  );
}

export function isMarketSnapshotShape(snapshot: unknown): snapshot is MarketSnapshot {
  if (!isRecord(snapshot) || snapshot.schemaVersion !== SNAPSHOT_SCHEMA_VERSION) {
    return false;
  }

  if (snapshot.kind !== "market" || !isRecord(snapshot.summary)) {
    return false;
  }

  return (
    Number.isInteger(snapshot.summary.assetCount) &&
    isNonEmptyString(snapshot.summary.total24hVolume, 64) &&
    isBoundedArray(snapshot.assets, 20, (asset): asset is MarketSnapshot["assets"][number] => {
      return (
        hasCommonAssetCore(asset) &&
        isRecord(asset) &&
        isBoundedArray(asset.orderBook, 10, isOrderBookEntry)
      );
    }) &&
    isBoundedArray(snapshot.recentTrades, 20, isTrade)
  );
}

export const createInsightRouteHandler = () =>
  createAiRouteHandler({
    buildPrompt: buildInsightPrompt,
    validateSnapshot: isAssetSnapshotShape,
  });

export const createBriefRouteHandler = () =>
  createAiRouteHandler({
    buildPrompt: buildBriefPrompt,
    validateSnapshot: isMarketSnapshotShape,
  });
