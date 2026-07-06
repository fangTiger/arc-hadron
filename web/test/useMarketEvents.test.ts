import { createElement } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { DEPLOY_BLOCK } from "../lib/chain";
import {
  HADRON_ASSETS_ADDRESS,
  HADRON_MARKET_ADDRESS,
  HADRON_YIELD_ADDRESS,
} from "../lib/contracts";
import type { TradeEvent } from "../lib/events";
import {
  marketEventsCacheKey,
  serializeMarketEventsCache,
} from "../lib/marketEventCache";
import { useMarketEvents } from "../lib/hooks/useMarketEvents";

type TestStorage = Storage & {
  clearItems: () => void;
};

const SELLER = "0x1000000000000000000000000000000000000001" as `0x${string}`;

const mockState = vi.hoisted(() => ({
  latestBlock: BigInt(process.env.NEXT_PUBLIC_DEPLOY_BLOCK ?? "49771985"),
  logBatches: [] as RawLog[][],
  publicClient: undefined as PublicClientMock | undefined,
}));

interface RawLog {
  args: {
    amount: bigint;
    listingId: bigint;
    pricePerShare: bigint;
    seller: `0x${string}`;
    tokenId: bigint;
  };
  blockNumber: bigint;
  eventName: "Listed";
  logIndex: number;
  transactionHash: `0x${string}`;
}

interface PublicClientMock {
  getBlock: (input: { blockNumber: bigint }) => Promise<{ timestamp: bigint }>;
  getBlockNumber: () => Promise<bigint>;
  getLogs: () => Promise<RawLog[]>;
}

vi.mock("wagmi", () => ({
  usePublicClient: () => mockState.publicClient,
}));

async function flushEffects() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function createTestStorage(): TestStorage {
  const items = new Map<string, string>();

  return {
    get length() {
      return items.size;
    },
    clear() {
      items.clear();
    },
    clearItems() {
      items.clear();
    },
    getItem(key: string) {
      return items.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(items.keys())[index] ?? null;
    },
    removeItem(key: string) {
      items.delete(key);
    },
    setItem(key: string, value: string) {
      items.set(key, value);
    },
  };
}

// ReactDOM 挂载 hook 只需要这些最小 DOM 能力；localStorage 用于覆盖缓存恢复语义。
function installDom() {
  const previous = {
    HTMLIFrameElement: globalThis.HTMLIFrameElement,
    HTMLElement: globalThis.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT,
    Node: globalThis.Node,
    document: globalThis.document,
    localStorage: globalThis.localStorage,
    window: globalThis.window,
  };
  const storage = createTestStorage();

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
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: storage,
  });

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
        hidden: false,
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
    hidden: false,
    nodeType: 9,
    removeEventListener: vi.fn(),
  };

  globalThis.document = document as unknown as Document;

  return {
    cleanup() {
      globalThis.document = previous.document;
      globalThis.HTMLIFrameElement = previous.HTMLIFrameElement;
      globalThis.HTMLElement = previous.HTMLElement;
      globalThis.IS_REACT_ACT_ENVIRONMENT = previous.IS_REACT_ACT_ENVIRONMENT;
      globalThis.Node = previous.Node;
      if (previous.localStorage === undefined) {
        Reflect.deleteProperty(globalThis, "localStorage");
      } else {
        Object.defineProperty(globalThis, "localStorage", {
          configurable: true,
          value: previous.localStorage,
        });
      }
      globalThis.window = previous.window;
    },
    storage,
  };
}

function txHash(index: number): `0x${string}` {
  return `0x${index.toString(16).padStart(64, "0")}` as `0x${string}`;
}

function tradeEvent(index: number, overrides: Partial<TradeEvent> = {}): TradeEvent {
  return {
    amount: 1n,
    blockNumber: BigInt(DEPLOY_BLOCK) + BigInt(index),
    listingId: BigInt(index),
    logIndex: index,
    pricePerShare: 10n,
    seller: SELLER,
    tokenId: BigInt(index),
    txHash: txHash(index),
    type: "listed",
    ...overrides,
  };
}

function rawLog(index: number): RawLog {
  const event = tradeEvent(index);

  return {
    args: {
      amount: event.amount ?? 1n,
      listingId: event.listingId ?? BigInt(index),
      pricePerShare: event.pricePerShare ?? 10n,
      seller: event.seller ?? SELLER,
      tokenId: event.tokenId,
    },
    blockNumber: event.blockNumber,
    eventName: "Listed",
    logIndex: event.logIndex,
    transactionHash: event.txHash,
  };
}

function eventKey(event: Pick<TradeEvent, "txHash" | "logIndex">): string {
  return `${event.txHash}:${event.logIndex}`;
}

function cacheKey(): string {
  return marketEventsCacheKey({
    assetsAddress: HADRON_ASSETS_ADDRESS,
    deployBlock: DEPLOY_BLOCK,
    marketAddress: HADRON_MARKET_ADDRESS,
    yieldAddress: HADRON_YIELD_ADDRESS,
  });
}

function createPublicClient(): PublicClientMock {
  return {
    getBlock: vi.fn(async ({ blockNumber }) => ({ timestamp: blockNumber })),
    getBlockNumber: vi.fn(async () => mockState.latestBlock),
    getLogs: vi.fn(async () => mockState.logBatches.shift() ?? []),
  };
}

async function mountHook() {
  let current: ReturnType<typeof useMarketEvents> | null = null;
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: Infinity,
        retry: false,
      },
    },
  });
  const container = document.createElement("div");
  const root = createRoot(container);

  function HookHost() {
    current = useMarketEvents();

    return null;
  }

  async function render() {
    await act(async () => {
      root.render(
        createElement(
          QueryClientProvider,
          { client: queryClient },
          createElement(HookHost),
        ),
      );
      await flushEffects();
    });
  }

  await render();

  if (!current) {
    throw new Error("Hook did not render");
  }

  return {
    get current() {
      return current as ReturnType<typeof useMarketEvents>;
    },
    queryClient,
    root,
  };
}

async function waitForCondition(assertion: () => void) {
  let lastError: unknown;

  for (let attempt = 0; attempt < 20; attempt += 1) {
    await act(async () => {
      await flushEffects();
    });

    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

describe("useMarketEvents newEvents", () => {
  let dom: ReturnType<typeof installDom>;
  let mountedRoot: Root | null;

  beforeEach(() => {
    dom = installDom();
    mountedRoot = null;
    mockState.latestBlock = BigInt(DEPLOY_BLOCK);
    mockState.logBatches = [];
    mockState.publicClient = createPublicClient();
  });

  afterEach(async () => {
    if (mountedRoot) {
      await act(async () => {
        mountedRoot?.unmount();
        await flushEffects();
      });
    }

    mockState.publicClient = undefined;
    dom.cleanup();
  });

  test("首次 mount 从 localStorage 恢复历史事件时 newEvents 为空", async () => {
    const cachedEvents = [tradeEvent(1), tradeEvent(2)];
    dom.storage.setItem(
      cacheKey(),
      serializeMarketEventsCache({
        events: cachedEvents,
        lastScannedBlock: BigInt(DEPLOY_BLOCK) + 2n,
      }),
    );
    mockState.publicClient = undefined;

    const mounted = await mountHook();
    mountedRoot = mounted.root;

    expect(mounted.current.events.map(eventKey)).toEqual(cachedEvents.map(eventKey));
    expect(mounted.current.newEvents).toEqual([]);
  });

  test("首次 refetch 拿到 3 个事件时 newEvents 恰为这 3 个", async () => {
    mockState.latestBlock = BigInt(DEPLOY_BLOCK) + 3n;
    mockState.logBatches = [[rawLog(1), rawLog(2), rawLog(3)]];

    const mounted = await mountHook();
    mountedRoot = mounted.root;

    await waitForCondition(() => {
      expect(mounted.current.newEvents.map(eventKey)).toEqual([
        eventKey(tradeEvent(1)),
        eventKey(tradeEvent(2)),
        eventKey(tradeEvent(3)),
      ]);
    });
  });

  test("连续两次 refetch 拿到同样数据时第二次 newEvents 为空", async () => {
    mockState.latestBlock = BigInt(DEPLOY_BLOCK) + 3n;
    mockState.logBatches = [[rawLog(1), rawLog(2), rawLog(3)]];

    const mounted = await mountHook();
    mountedRoot = mounted.root;

    await waitForCondition(() => {
      expect(mounted.current.newEvents.map(eventKey)).toEqual([
        eventKey(tradeEvent(1)),
        eventKey(tradeEvent(2)),
        eventKey(tradeEvent(3)),
      ]);
    });

    mockState.latestBlock = BigInt(DEPLOY_BLOCK) + 4n;
    mockState.logBatches = [[rawLog(1), rawLog(2), rawLog(3)]];

    await act(async () => {
      await mounted.queryClient.refetchQueries({ queryKey: ["market-events"] });
      await flushEffects();
    });

    await waitForCondition(() => {
      expect(mounted.current.newEvents).toEqual([]);
    });
  });

  test("后续 refetch 只把未见过的事件放入 newEvents", async () => {
    mockState.latestBlock = BigInt(DEPLOY_BLOCK) + 2n;
    mockState.logBatches = [[rawLog(1), rawLog(2)]];

    const mounted = await mountHook();
    mountedRoot = mounted.root;

    await waitForCondition(() => {
      expect(mounted.current.newEvents.map(eventKey)).toEqual([
        eventKey(tradeEvent(1)),
        eventKey(tradeEvent(2)),
      ]);
    });

    mockState.latestBlock = BigInt(DEPLOY_BLOCK) + 4n;
    mockState.logBatches = [[rawLog(2), rawLog(3), rawLog(4)]];

    await act(async () => {
      await mounted.queryClient.refetchQueries({ queryKey: ["market-events"] });
      await flushEffects();
    });

    await waitForCondition(() => {
      expect(mounted.current.newEvents.map(eventKey)).toEqual([
        eventKey(tradeEvent(3)),
        eventKey(tradeEvent(4)),
      ]);
    });
  });
});
