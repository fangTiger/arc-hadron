import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { fingerprintSnapshot } from "../lib/ai/fingerprint";
import { encodeSseEvent } from "../lib/ai/sse";
import { SNAPSHOT_SCHEMA_VERSION, type AssetSnapshot } from "../lib/ai/snapshot";
import { useAiGeneration, type UseAiGenerationResult } from "../lib/ai/useAiGeneration";

const MARKET_ADDRESS = "0x962aba0A590981cf9c5B336aC34922c82f203165";
const CACHE_KEY = `hadron:ai:insight:${SNAPSHOT_SCHEMA_VERSION}:5042002:${MARKET_ADDRESS.toLowerCase()}:15`;

function assetSnapshot(overrides: Partial<AssetSnapshot["asset"]> = {}): AssetSnapshot {
  return {
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
      description: "Short-duration Treasury exposure.",
      slug: "t-bill-2026-q3",
      ...overrides,
    },
    orderBook: [{ id: "1", remaining: "250", sharePrice: "1.31" }],
    priceSeries: [{ t: Date.UTC(2026, 6, 3, 9), sharePrice: "1.25" }],
    recentTrades: [],
  };
}

async function flushEffects() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function installDom() {
  const previous = {
    HTMLIFrameElement: globalThis.HTMLIFrameElement,
    HTMLElement: globalThis.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT,
    Node: globalThis.Node,
    document: globalThis.document,
    window: globalThis.window,
  };

  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = globalThis as Window & typeof globalThis;
  globalThis.HTMLElement = class HTMLElement {} as typeof HTMLElement;
  globalThis.HTMLIFrameElement = class HTMLIFrameElement {} as typeof HTMLIFrameElement;
  globalThis.Node = {
    COMMENT_NODE: 8,
    DOCUMENT_FRAGMENT_NODE: 11,
    DOCUMENT_NODE: 9,
    ELEMENT_NODE: 1,
    TEXT_NODE: 3,
  } as typeof Node;

  interface TestElement {
    childNodes: TestNode[];
    parentNode: TestElement | null;
  }

  type TestNode = TestElement & {
    nodeType: number;
    nodeValue?: string;
  };

  const document = {
    activeElement: null,
    addEventListener: vi.fn(),
    createElement(tag: string) {
      return {
        addEventListener: vi.fn(),
        appendChild(child: TestNode) {
          this.childNodes.push(child);
          child.parentNode = this;
          return child;
        },
        childNodes: [] as TestNode[],
        insertBefore(child: TestNode) {
          this.childNodes.push(child);
          child.parentNode = this;
          return child;
        },
        nodeName: tag.toUpperCase(),
        nodeType: 1,
        ownerDocument: document,
        parentNode: null as TestElement | null,
        removeAttribute: vi.fn(),
        removeChild(child: TestNode) {
          this.childNodes = this.childNodes.filter((item) => item !== child);
          child.parentNode = null;
          return child;
        },
        removeEventListener: vi.fn(),
        setAttribute: vi.fn(),
        style: {},
        tagName: tag.toUpperCase(),
      };
    },
    createTextNode(text: string) {
      return {
        nodeType: 3,
        nodeValue: text,
        ownerDocument: document,
        parentNode: null,
      };
    },
    defaultView: globalThis,
    nodeType: 9,
    removeEventListener: vi.fn(),
  };

  globalThis.document = document as unknown as Document;

  return () => {
    globalThis.document = previous.document;
    globalThis.HTMLIFrameElement = previous.HTMLIFrameElement;
    globalThis.HTMLElement = previous.HTMLElement;
    globalThis.IS_REACT_ACT_ENVIRONMENT = previous.IS_REACT_ACT_ENVIRONMENT;
    globalThis.Node = previous.Node;
    globalThis.window = previous.window;
  };
}

function installLocalStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  const localStorage = {
    clear: vi.fn(() => store.clear()),
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    key: vi.fn((index: number) => Array.from(store.keys())[index] ?? null),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    get length() {
      return store.size;
    },
  } satisfies Storage;

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: localStorage,
  });

  return localStorage;
}

function streamResponse(text: string): Response {
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        const midpoint = Math.floor(text.length / 2);
        controller.enqueue(new TextEncoder().encode(text.slice(0, midpoint)));
        controller.enqueue(new TextEncoder().encode(text.slice(midpoint)));
        controller.close();
      },
    }),
    {
      headers: { "content-type": "text/event-stream" },
      status: 200,
    },
  );
}

function abortablePendingResponse(signal: AbortSignal): Promise<Response> {
  return new Promise((_resolve, reject) => {
    signal.addEventListener(
      "abort",
      () => reject(new DOMException("Aborted", "AbortError")),
      { once: true },
    );
  });
}

async function mountHook(snapshot: AssetSnapshot = assetSnapshot()) {
  let current: UseAiGenerationResult | null = null;
  const container = document.createElement("div");
  const root = createRoot(container);

  function HookHost() {
    current = useAiGeneration({
      chainId: 5042002,
      endpoint: "/api/ai/insight",
      marketAddress: MARKET_ADDRESS,
      purpose: "insight",
      snapshot,
    });

    return null;
  }

  await act(async () => {
    root.render(<HookHost />);
    await flushEffects();
  });

  if (!current) {
    throw new Error("Hook did not render");
  }

  return {
    get current() {
      return current as UseAiGenerationResult;
    },
    root,
  };
}

describe("useAiGeneration", () => {
  let cleanupDom: () => void;
  let root: Root | null;

  beforeEach(() => {
    cleanupDom = installDom();
    root = null;
    vi.useRealTimers();
    vi.restoreAllMocks();
    installLocalStorage();
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
        await flushEffects();
      });
    }

    cleanupDom();
    vi.unstubAllGlobals();
  });

  test("streams POSTed snapshot SSE frames into markdown and writes the fingerprinted cache", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      streamResponse(
        `${encodeSseEvent("chunk", { delta: "## Outlook\n" })}${encodeSseEvent("chunk", { delta: "Liquidity is thin." })}${encodeSseEvent("done", { ok: true })}`,
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const storage = installLocalStorage();
    const mounted = await mountHook();
    root = mounted.root;

    await act(async () => {
      await mounted.current.generate();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ai/insight",
      expect.objectContaining({
        body: JSON.stringify(assetSnapshot()),
        method: "POST",
        signal: expect.any(AbortSignal),
      }),
    );
    expect(mounted.current.status).toBe("done");
    expect(mounted.current.markdown).toBe("## Outlook\nLiquidity is thin.");
    expect(mounted.current.error).toBeNull();
    expect(mounted.current.cachedFingerprint).toBe(fingerprintSnapshot(assetSnapshot()));
    expect(storage.setItem).toHaveBeenCalledWith(
      CACHE_KEY,
      expect.stringContaining('"markdown":"## Outlook\\nLiquidity is thin."'),
    );
  });

  test("hydrates cached markdown, keeps stale cached content visible, and reports fingerprint drift", async () => {
    const cachedFingerprint = fingerprintSnapshot(assetSnapshot());
    const changedSnapshot = assetSnapshot({ latestSharePrice: "1.42" });
    installLocalStorage({
      [CACHE_KEY]: JSON.stringify({
        markdown: "Cached insight",
        fingerprint: cachedFingerprint,
        generatedAt: 1_783_072_800_000,
      }),
    });
    const mounted = await mountHook(changedSnapshot);
    root = mounted.root;

    expect(mounted.current.status).toBe("done");
    expect(mounted.current.markdown).toBe("Cached insight");
    expect(mounted.current.generatedAt).toBe(1_783_072_800_000);
    expect(mounted.current.cachedFingerprint).toBe(cachedFingerprint);
    expect(mounted.current.currentFingerprint).toBe(fingerprintSnapshot(changedSnapshot));
    expect(mounted.current.isStale).toBe(true);
  });

  test("aborts an active stream before starting a replacement request and aborts on unmount", async () => {
    let firstSignal: AbortSignal | undefined;
    let secondSignal: AbortSignal | undefined;
    const fetchMock = vi
      .fn()
      .mockImplementationOnce((_url: string, init: RequestInit) => {
        firstSignal = init.signal as AbortSignal;
        return abortablePendingResponse(firstSignal);
      })
      .mockImplementationOnce((_url: string, init: RequestInit) => {
        secondSignal = init.signal as AbortSignal;
        return abortablePendingResponse(secondSignal);
      });
    vi.stubGlobal("fetch", fetchMock);
    const mounted = await mountHook();
    root = mounted.root;

    const firstRun = mounted.current.generate();
    await flushEffects();

    const secondRun = mounted.current.generate();
    await flushEffects();

    expect(firstSignal?.aborted).toBe(true);
    expect(secondSignal?.aborted).toBe(false);

    await act(async () => {
      root?.unmount();
      root = null;
      await flushEffects();
    });

    expect(secondSignal?.aborted).toBe(true);
    await expect(firstRun).resolves.toBeUndefined();
    await expect(secondRun).resolves.toBeUndefined();
  });

  test("surfaces HTTP errors while localStorage failures silently degrade", async () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: vi.fn(() => {
          throw new Error("blocked");
        }),
        setItem: vi.fn(() => {
          throw new Error("blocked");
        }),
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Too many requests" }), {
          headers: { "content-type": "application/json" },
          status: 429,
        }),
      ),
    );
    const mounted = await mountHook();
    root = mounted.root;

    await act(async () => {
      await mounted.current.generate();
    });

    expect(mounted.current.status).toBe("error");
    expect(mounted.current.error).toBe("Too many requests");
    expect(mounted.current.markdown).toBe("");
  });
});
