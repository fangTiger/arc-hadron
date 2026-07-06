"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fingerprintSnapshot } from "@/lib/ai/fingerprint";
import { createSseFrameParser, type AiSseEvent } from "@/lib/ai/sse";
import type { AssetSnapshot, MarketSnapshot } from "@/lib/ai/snapshot";

export type AiGenerationPurpose = "insight" | "brief";
export type AiGenerationStatus = "idle" | "streaming" | "done" | "error";

export interface UseAiGenerationOptions {
  chainId: number | string;
  endpoint: string;
  marketAddress: string;
  purpose: AiGenerationPurpose;
  snapshot: AssetSnapshot | MarketSnapshot;
  tokenId?: bigint | number | string;
}

export interface UseAiGenerationResult {
  status: AiGenerationStatus;
  markdown: string;
  error: string | null;
  generatedAt: number | null;
  cachedFingerprint: string | null;
  currentFingerprint: string;
  isStale: boolean;
  generate: () => Promise<void>;
}

interface CachedGeneration {
  markdown: string;
  fingerprint: string;
  generatedAt: number;
}

function insightTokenId(snapshot: AssetSnapshot | MarketSnapshot, tokenId?: bigint | number | string): string {
  if (tokenId !== undefined) {
    return tokenId.toString();
  }

  return snapshot.kind === "asset" ? snapshot.asset.tokenId : "market";
}

export function aiGenerationCacheKey({
  chainId,
  marketAddress,
  purpose,
  snapshot,
  tokenId,
}: Pick<UseAiGenerationOptions, "chainId" | "marketAddress" | "purpose" | "snapshot" | "tokenId">): string {
  const base = [
    "hadron:ai",
    purpose,
    snapshot.schemaVersion,
    chainId.toString(),
    marketAddress.toLowerCase(),
  ];

  if (purpose === "insight") {
    base.push(insightTokenId(snapshot, tokenId));
  }

  return base.join(":");
}

function storage(): Storage | null {
  try {
    if (typeof window === "undefined") {
      return null;
    }

    return window.localStorage;
  } catch {
    return null;
  }
}

function isCachedGeneration(value: unknown): value is CachedGeneration {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const entry = value as Partial<CachedGeneration>;

  return (
    typeof entry.markdown === "string" &&
    typeof entry.fingerprint === "string" &&
    typeof entry.generatedAt === "number" &&
    Number.isFinite(entry.generatedAt)
  );
}

function readCache(key: string): CachedGeneration | null {
  try {
    const raw = storage()?.getItem(key);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);

    return isCachedGeneration(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeCache(key: string, entry: CachedGeneration) {
  try {
    storage()?.setItem(key, JSON.stringify(entry));
  } catch {
    // localStorage 在隐私模式或配额耗尽时可能失败，生成能力应继续可用。
  }
}

function eventDelta(event: AiSseEvent): string | null {
  const data = event.data as { delta?: unknown };

  return typeof data.delta === "string" ? data.delta : null;
}

function eventMessage(event: AiSseEvent): string {
  const data = event.data as { message?: unknown };

  return typeof data.message === "string" && data.message.length > 0
    ? data.message
    : "Generation failed";
}

async function responseError(response: Response): Promise<string> {
  try {
    const json = (await response.json()) as { error?: unknown };

    if (typeof json.error === "string" && json.error.length > 0) {
      return json.error;
    }
  } catch {
    // 非 JSON 响应使用通用错误，避免把 HTML 错误页暴露到 UI。
  }

  if (response.status === 429) {
    return "Too many requests";
  }

  return "Generation failed";
}

export function useAiGeneration({
  chainId,
  endpoint,
  marketAddress,
  purpose,
  snapshot,
  tokenId,
}: UseAiGenerationOptions): UseAiGenerationResult {
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef(0);
  const currentFingerprint = useMemo(
    () => fingerprintSnapshot(snapshot),
    [snapshot],
  );
  const cacheKey = useMemo(
    () =>
      aiGenerationCacheKey({
        chainId,
        marketAddress,
        purpose,
        snapshot,
        tokenId,
      }),
    [chainId, marketAddress, purpose, snapshot, tokenId],
  );
  const [hydratedCache, setHydratedCache] = useState<{
    cacheKey: string;
    generation: CachedGeneration | null;
  } | null>(null);
  const [state, setState] = useState<{
    cacheKey: string | null;
    status: AiGenerationStatus;
    markdown: string;
    error: string | null;
    generatedAt: number | null;
    cachedFingerprint: string | null;
  }>({
    cacheKey: null,
    status: "idle",
    markdown: "",
    error: null,
    generatedAt: null,
    cachedFingerprint: null,
  });

  useEffect(
    () => () => {
      abortRef.current?.abort();
      abortRef.current = null;
    },
    [],
  );

  useEffect(() => {
    let isActive = true;

    queueMicrotask(() => {
      if (!isActive) {
        return;
      }

      setHydratedCache({
        cacheKey,
        generation: readCache(cacheKey),
      });
    });

    return () => {
      isActive = false;
    };
  }, [cacheKey]);

  const generate = useCallback(async () => {
    abortRef.current?.abort();

    const abortController = new AbortController();
    const runId = runIdRef.current + 1;
    const parser = createSseFrameParser();
    const decoder = new TextDecoder();
    let markdown = "";
    let sawDone = false;

    runIdRef.current = runId;
    abortRef.current = abortController;
    setState({
      cacheKey,
      status: "streaming",
      markdown: "",
      error: null,
      generatedAt: null,
      cachedFingerprint: null,
    });

    const applyEvent = (event: AiSseEvent) => {
      if (event.type === "done") {
        sawDone = true;

        return;
      }

      if (event.type === "chunk") {
        const delta = eventDelta(event);

        if (!delta) {
          return;
        }

        markdown += delta;

        if (runIdRef.current === runId) {
          setState((current) => ({
            ...current,
            cacheKey,
            status: "streaming",
            markdown,
          }));
        }

        return;
      }

      if (event.type === "error") {
        throw new Error(eventMessage(event));
      }
    };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(snapshot),
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(await responseError(response));
      }

      if (!response.body) {
        throw new Error("Generation failed");
      }

      const reader = response.body.getReader();

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        for (const event of parser.push(decoder.decode(value, { stream: true }))) {
          applyEvent(event);
        }
      }

      const tail = decoder.decode();

      if (tail) {
        for (const event of parser.push(tail)) {
          applyEvent(event);
        }
      }

      // 没等到 done 帧就 EOF 说明流被截断，残缺内容不得入缓存（spec 要求）。
      if (!sawDone) {
        throw new Error("Generation interrupted");
      }

      if (runIdRef.current !== runId) {
        return;
      }

      const generatedAt = Date.now();

      writeCache(cacheKey, {
        markdown,
        fingerprint: currentFingerprint,
        generatedAt,
      });
      setState({
        cacheKey,
        status: "done",
        markdown,
        error: null,
        generatedAt,
        cachedFingerprint: currentFingerprint,
      });
    } catch (error) {
      if (abortController.signal.aborted || runIdRef.current !== runId) {
        return;
      }

      setState({
        cacheKey,
        status: "error",
        markdown: "",
        error: error instanceof Error ? error.message : "Generation failed",
        generatedAt: null,
        cachedFingerprint: null,
      });
    } finally {
      if (abortRef.current === abortController) {
        abortRef.current = null;
      }
    }
  }, [cacheKey, currentFingerprint, endpoint, snapshot]);

  const cachedGeneration =
    hydratedCache?.cacheKey === cacheKey ? hydratedCache.generation : null;
  const displayState =
    state.cacheKey === cacheKey
      ? state
      : cachedGeneration
        ? {
            cacheKey,
            status: "done" as const,
            markdown: cachedGeneration.markdown,
            error: null,
            generatedAt: cachedGeneration.generatedAt,
            cachedFingerprint: cachedGeneration.fingerprint,
          }
        : {
            cacheKey,
            status: "idle" as const,
            markdown: "",
            error: null,
            generatedAt: null,
            cachedFingerprint: null,
          };

  return {
    status: displayState.status,
    markdown: displayState.markdown,
    error: displayState.error,
    generatedAt: displayState.generatedAt,
    cachedFingerprint: displayState.cachedFingerprint,
    currentFingerprint,
    generate,
    isStale: Boolean(
      displayState.cachedFingerprint && displayState.cachedFingerprint !== currentFingerprint,
    ),
  };
}
