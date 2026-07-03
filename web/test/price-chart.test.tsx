import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import type { TradeEvent } from "../lib/events";
import type { AssetView } from "../lib/mappers";

const setData = vi.fn();
const createPriceLine = vi.fn(() => ({ applyOptions: vi.fn() }));
const addSeries = vi.fn(() => ({ createPriceLine, setData }));
const fitContent = vi.fn();
const remove = vi.fn();
const createChart = vi.fn(() => ({
  addSeries,
  remove,
  timeScale: () => ({ fitContent }),
}));

vi.mock("lightweight-charts", () => ({
  AreaSeries: Symbol("AreaSeries"),
  ColorType: { Solid: "solid" },
  CrosshairMode: { Normal: 0 },
  LastPriceAnimationMode: { OnDataUpdate: 2 },
  LineStyle: { Dashed: 2, Dotted: 1, Solid: 0 },
  createChart,
}));

async function flushEffects() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

// ReactDOM 只需要这些 DOM 能力即可挂载本组件并触发 useEffect。
function installDom() {
  const previous = {
    HTMLIFrameElement: globalThis.HTMLIFrameElement,
    HTMLElement: globalThis.HTMLElement,
    Node: globalThis.Node,
    document: globalThis.document,
    window: globalThis.window,
  };

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
    globalThis.Node = previous.Node;
    globalThis.window = previous.window;
  };
}

const USDC = 10n ** 18n;

function unitPriceFromSharePriceCents(cents: bigint): bigint {
  return (cents * USDC) / 10_000n;
}

function assetView(overrides: Partial<AssetView> = {}): AssetView {
  return {
    category: "treasuries",
    meta: {
      apyBps: 510,
      description: "Test asset",
      displayName: "US T-Bill 2026-Q3",
      docs: [],
      issuer: "Hadron Treasury Desk",
      slug: "t-bill-2026-q3",
      ticker: "TBILL",
    },
    name: "US T-BILL 2026-Q3",
    offering: {
      active: true,
      id: 1n,
      pricePerShare: unitPriceFromSharePriceCents(10_000n),
      remaining: 1_000n,
      tokenId: 15n,
    },
    tokenId: 15n,
    totalShares: 10_000n,
    ...overrides,
  };
}

function tradeEvent(overrides: Partial<TradeEvent> = {}): TradeEvent {
  return {
    amount: 100n,
    blockNumber: 1n,
    logIndex: 0,
    pricePerShare: unitPriceFromSharePriceCents(11_000n),
    timestamp: Date.UTC(2026, 6, 3, 10, 0, 0),
    tokenId: 15n,
    totalPaid: 110n * USDC,
    txHash: "0x0000000000000000000000000000000000000000000000000000000000000001",
    type: "primary-sale",
    ...overrides,
  };
}

describe("PriceChart lifecycle", () => {
  let cleanupDom: () => void;
  let container: HTMLElement;
  let root: Root | null;

  beforeEach(() => {
    cleanupDom = installDom();
    container = document.createElement("div");
    root = createRoot(container);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    root?.unmount();
    await flushEffects();
    cleanupDom();
  });

  test("creates the chart on mount, updates data, and removes it on unmount", async () => {
    const { PriceChart } = await import("../components/asset/PriceChart");
    const asset = assetView();

    root?.render(<PriceChart asset={asset} events={[tradeEvent()]} />);
    await flushEffects();

    expect(createChart).toHaveBeenCalledTimes(1);
    expect(addSeries).toHaveBeenCalledTimes(1);
    expect(setData).toHaveBeenLastCalledWith([
      { time: 0, value: 100 },
    ]);

    root?.render(
      <PriceChart
        asset={asset}
        events={[
          tradeEvent({ logIndex: 0, pricePerShare: unitPriceFromSharePriceCents(11_000n) }),
          tradeEvent({
            logIndex: 1,
            pricePerShare: unitPriceFromSharePriceCents(12_500n),
            timestamp: Date.UTC(2026, 6, 3, 10, 0, 1),
          }),
        ]}
      />,
    );
    await flushEffects();

    expect(createChart).toHaveBeenCalledTimes(1);
    expect(setData).toHaveBeenLastCalledWith([
      { time: 1_783_072_800, value: 110 },
      { time: 1_783_072_801, value: 125 },
    ]);

    root?.unmount();
    root = null;

    expect(remove).toHaveBeenCalledTimes(1);
  });
});
