import { act } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, test, vi } from "vitest";
import {
  AssistantPanelView,
  type AssistantCard,
  type AssistantPanelViewProps,
} from "../components/assistant/AssistantPanel";

const connectMock = vi.hoisted(() => vi.fn());
const invalidateQueriesMock = vi.hoisted(() => vi.fn());
const pushErrorMock = vi.hoisted(() => vi.fn());
const pushSuccessMock = vi.hoisted(() => vi.fn());
const useAllBidsMock = vi.hoisted(() =>
  vi.fn(() => ({
    bids: [],
    isLoading: false,
  })),
);
const useAllListingsMock = vi.hoisted(() =>
  vi.fn(() => ({
    listings: [],
    isLoading: false,
  })),
);
const useAssetsMock = vi.hoisted(() =>
  vi.fn(() => ({
    assets: [],
    isLoading: false,
  })),
);
const usePortfolioMock = vi.hoisted(() =>
  vi.fn(() => ({
    holdings: [],
    isLoading: false,
  })),
);

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({
    invalidateQueries: invalidateQueriesMock,
  }),
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({
    address: undefined,
    isConnected: false,
  }),
  useConnect: () => ({
    connect: connectMock,
    connectors: [],
  }),
}));

vi.mock("@/components/ui/TxToast", () => ({
  useToast: () => ({
    pushError: pushErrorMock,
    pushSuccess: pushSuccessMock,
  }),
}));

vi.mock("@/lib/hooks/useNetworkGuard", () => ({
  useNetworkGuard: () => ({
    isCorrectChain: true,
    switchToArc: vi.fn(),
  }),
}));

vi.mock("@/lib/hooks/useAssets", () => ({
  useAssets: useAssetsMock,
}));

vi.mock("@/lib/hooks/useListings", () => ({
  useAllListings: useAllListingsMock,
}));

vi.mock("@/lib/hooks/useBids", () => ({
  useAllBids: useAllBidsMock,
}));

vi.mock("@/lib/hooks/usePortfolio", () => ({
  usePortfolio: usePortfolioMock,
}));

vi.mock("@/lib/hooks/useBuyPrimary", () => ({
  useBuyPrimary: () => ({
    buy: vi.fn(),
    reset: vi.fn(),
    status: "idle",
  }),
}));

vi.mock("@/lib/hooks/useBuyListing", () => ({
  useBuyListing: () => ({
    buy: vi.fn(),
    reset: vi.fn(),
    status: "idle",
  }),
}));

vi.mock("@/lib/hooks/useListForSale", () => ({
  useListForSale: () => ({
    listForSale: vi.fn(),
    reset: vi.fn(),
    status: "idle",
  }),
}));

vi.mock("@/lib/hooks/useCancelListing", () => ({
  useCancelListing: () => ({
    cancel: vi.fn(),
    reset: vi.fn(),
    status: "idle",
  }),
}));

vi.mock("@/lib/hooks/useCancelBid", () => ({
  useCancelBid: () => ({
    cancelBid: vi.fn(),
    reset: vi.fn(),
    status: "idle",
  }),
}));

vi.mock("@/lib/hooks/useYield", () => ({
  useClaimYield: () => ({
    claim: vi.fn(),
    claimBatch: vi.fn(),
    reset: vi.fn(),
    status: "idle",
  }),
  usePendingYield: () => ({
    isLoading: false,
    pending: [],
    pendingByTokenId: new Map(),
    totalPending: 0n,
  }),
}));

const USDC = 10n ** 18n;

function unitPriceFromSharePriceCents(cents: bigint): bigint {
  return (cents * USDC) / 10_000n;
}

function panelProps(overrides: Partial<AssistantPanelViewProps> = {}): AssistantPanelViewProps {
  return {
    cards: [],
    defaultAssetLabel: "TBILL",
    errorText: null,
    inputValue: "",
    isOpen: true,
    isSubmitting: false,
    onClose: () => undefined,
    onInputChange: () => undefined,
    onSubmit: () => undefined,
    ...overrides,
  };
}

function renderPanel(cards: AssistantCard[], overrides: Partial<AssistantPanelViewProps> = {}): string {
  return renderToStaticMarkup(
    <AssistantPanelView {...panelProps({ cards, ...overrides })} />,
  );
}

interface TestEvent {
  bubbles?: boolean;
  cancelBubble?: boolean;
  cancelable?: boolean;
  currentTarget?: TestElement | TestDocument;
  defaultPrevented?: boolean;
  key?: string;
  srcElement?: TestElement;
  target?: TestElement;
  timeStamp?: number;
  type: string;
  preventDefault: () => void;
  stopPropagation: () => void;
}

type TestListener = (event: TestEvent) => void;

interface TestNode {
  childNodes?: TestNode[];
  nodeType: number;
  nodeValue?: string;
  parentNode: TestElement | null;
  selectionEnd: number;
  selectionStart: number;
  setSelectionRange: (start: number, end: number) => void;
  textContent: string;
  value: string;
}

interface TestElement extends TestNode {
  _listeners: Record<string, TestListener[]>;
  attributes: Record<string, string>;
  blur: () => void;
  contains: (node: TestNode) => boolean;
  dispatchEvent: (event: TestEvent) => boolean;
  focus: () => void;
  getAttribute: (name: string) => string | null;
  hasAttribute: (name: string) => boolean;
  tagName: string;
}

interface TestDocument {
  _listeners: Record<string, TestListener[]>;
  activeElement: TestElement | null;
  body?: TestElement;
  defaultView: typeof globalThis;
  nodeType: number;
  addEventListener: (type: string, listener: TestListener) => void;
  createElement: (tag: string) => TestElement;
  createElementNS: (_namespace: string, tag: string) => TestElement;
  createTextNode: (text: string) => TestNode;
  removeEventListener: (type: string, listener: TestListener) => void;
}

function installDom() {
  const previous = {
    HTMLIFrameElement: globalThis.HTMLIFrameElement,
    HTMLElement: globalThis.HTMLElement,
    IS_REACT_ACT_ENVIRONMENT: globalThis.IS_REACT_ACT_ENVIRONMENT,
    Node: globalThis.Node,
    SVGElement: globalThis.SVGElement,
    document: globalThis.document,
    window: globalThis.window,
  };

  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.window = globalThis as Window & typeof globalThis;
  globalThis.HTMLElement = class HTMLElement {} as typeof HTMLElement;
  globalThis.HTMLIFrameElement = class HTMLIFrameElement {} as typeof HTMLIFrameElement;
  globalThis.SVGElement = class SVGElement {} as typeof SVGElement;
  globalThis.Node = {
    COMMENT_NODE: 8,
    DOCUMENT_FRAGMENT_NODE: 11,
    DOCUMENT_NODE: 9,
    ELEMENT_NODE: 1,
    TEXT_NODE: 3,
  } as typeof Node;

  const document: TestDocument = {
    _listeners: {},
    activeElement: null,
    defaultView: globalThis,
    nodeType: 9,
    addEventListener(type, listener) {
      this._listeners[type] = [...(this._listeners[type] ?? []), listener];
    },
    createElement(tag) {
      return createElement(tag, document);
    },
    createElementNS(_namespace, tag) {
      return createElement(tag, document);
    },
    createTextNode(text) {
      return {
        nodeType: 3,
        nodeValue: text,
        parentNode: null,
        get textContent() {
          return this.nodeValue ?? "";
        },
        set textContent(value: string) {
          this.nodeValue = value;
        },
      };
    },
    removeEventListener(type, listener) {
      this._listeners[type] = (this._listeners[type] ?? []).filter((item) => item !== listener);
    },
  };

  document.body = createElement("body", document);
  globalThis.document = document as unknown as Document;

  return () => {
    globalThis.document = previous.document;
    globalThis.HTMLIFrameElement = previous.HTMLIFrameElement;
    globalThis.HTMLElement = previous.HTMLElement;
    globalThis.IS_REACT_ACT_ENVIRONMENT = previous.IS_REACT_ACT_ENVIRONMENT;
    globalThis.Node = previous.Node;
    globalThis.SVGElement = previous.SVGElement;
    globalThis.window = previous.window;
  };
}

function createElement(tag: string, ownerDocument: TestDocument): TestElement {
  const element = {
    _listeners: {},
    attributes: {},
    childNodes: [],
    namespaceURI: "http://www.w3.org/1999/xhtml",
    nodeName: tag.toUpperCase(),
    nodeType: 1,
    ownerDocument,
    parentNode: null,
    selectionEnd: 0,
    selectionStart: 0,
    style: {},
    tagName: tag.toUpperCase(),
    value: "",
    appendChild(child: TestNode) {
      this.childNodes.push(child);
      child.parentNode = this;
      return child;
    },
    blur() {
      if (ownerDocument.activeElement === this) {
        ownerDocument.activeElement = null;
      }
    },
    contains(node: TestNode) {
      if (node === this) {
        return true;
      }

      return this.childNodes.some(
        (child) => child === node || ("contains" in child && child.contains(node)),
      );
    },
    dispatchEvent(event: TestEvent) {
      event.target ??= this;
      event.srcElement ??= this;
      event.timeStamp ??= Date.now();
      event.preventDefault ??= () => {
        event.defaultPrevented = true;
      };
      event.stopPropagation ??= () => {
        event.cancelBubble = true;
      };

      dispatchEventFrom(this, event);

      return !event.defaultPrevented;
    },
    focus() {
      ownerDocument.activeElement = this;
    },
    getAttribute(name: string) {
      return this.attributes[name] ?? null;
    },
    hasAttribute(name: string) {
      return this.attributes[name] !== undefined;
    },
    insertBefore(child: TestNode, before: TestNode | null) {
      const index = before ? this.childNodes.indexOf(before) : -1;

      if (index === -1) {
        this.childNodes.push(child);
      } else {
        this.childNodes.splice(index, 0, child);
      }

      child.parentNode = this;
      return child;
    },
    removeAttribute(name: string) {
      delete this.attributes[name];
      delete (this as Record<string, unknown>)[name];
    },
    removeChild(child: TestNode) {
      this.childNodes = this.childNodes.filter((item) => item !== child);
      child.parentNode = null;
      return child;
    },
    removeEventListener(type: string, listener: TestListener) {
      this._listeners[type] = (this._listeners[type] ?? []).filter((item) => item !== listener);
    },
    setAttribute(name: string, value: string) {
      this.attributes[name] = value;
      (this as Record<string, unknown>)[name] = value;
    },
    setSelectionRange(start: number, end: number) {
      this.selectionStart = start;
      this.selectionEnd = end;
    },
    addEventListener(type: string, listener: TestListener) {
      this._listeners[type] = [...(this._listeners[type] ?? []), listener];
    },
    get firstChild() {
      return this.childNodes[0] ?? null;
    },
    get lastChild() {
      return this.childNodes[this.childNodes.length - 1] ?? null;
    },
    get nextSibling() {
      if (!this.parentNode) {
        return null;
      }

      const index = this.parentNode.childNodes.indexOf(this);

      return this.parentNode.childNodes[index + 1] ?? null;
    },
    get textContent() {
      return this.childNodes.map((child) => child.textContent).join("");
    },
    set textContent(value: string) {
      this.childNodes = [];

      if (value) {
        this.appendChild(ownerDocument.createTextNode(value));
      }
    },
  } satisfies TestElement & {
    namespaceURI: string;
    nodeName: string;
    ownerDocument: TestDocument;
    style: Record<string, string>;
  };

  return element;
}

function dispatchEventFrom(element: TestElement, event: TestEvent) {
  event.currentTarget = element;

  for (const listener of element._listeners[event.type] ?? []) {
    listener(event);
  }

  if (event.cancelBubble || !event.bubbles || !element.parentNode) {
    return;
  }

  dispatchEventFrom(element.parentNode, event);
}

function findElements(node: TestNode, predicate: (element: TestElement) => boolean): TestElement[] {
  if (node.nodeType !== 1 || !("childNodes" in node)) {
    return [];
  }

  const element = node as TestElement;
  const matches = predicate(element) ? [element] : [];

  return [
    ...matches,
    ...element.childNodes.flatMap((child) => findElements(child, predicate)),
  ];
}

function attr(element: TestElement, name: string): string | null {
  return element.getAttribute(name) ?? ((element as unknown as Record<string, string>)[name] ?? null);
}

function documentBody(): TestElement {
  const body = (document as unknown as TestDocument).body;

  if (!body) {
    throw new Error("Test document body is not installed");
  }

  return body;
}

function keyEvent(key: string): TestEvent {
  return {
    bubbles: true,
    cancelable: true,
    defaultPrevented: false,
    key,
    type: "keydown",
    preventDefault() {
      this.defaultPrevented = true;
    },
    stopPropagation() {
      this.cancelBubble = true;
    },
  };
}

function submitEvent(): TestEvent {
  return {
    bubbles: true,
    cancelable: true,
    defaultPrevented: false,
    type: "submit",
    preventDefault() {
      this.defaultPrevented = true;
    },
    stopPropagation() {
      this.cancelBubble = true;
    },
  };
}

async function flushEffects() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

async function mountPanel(overrides: Partial<AssistantPanelViewProps>) {
  const container = document.createElement("div") as unknown as TestElement;
  const root = createRoot(container as unknown as Element);

  await act(async () => {
    root.render(<AssistantPanelView {...panelProps(overrides)} />);
    await flushEffects();
  });

  return { container, root };
}

async function unmount(root: Root) {
  await act(async () => {
    root.unmount();
    await flushEffects();
  });
}

function installFetch(fetchImpl: typeof fetch) {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl;

  return () => {
    globalThis.fetch = previousFetch;
  };
}

let dockPanelProps: AssistantPanelViewProps | null = null;

async function mountDockWithPanelMock() {
  dockPanelProps = null;
  vi.resetModules();
  vi.doMock("@/components/assistant/AssistantPanel", () => ({
    AssistantPanelView: (props: AssistantPanelViewProps) => {
      dockPanelProps = props;
      return null;
    },
  }));

  const { AssistantDock } = await import("../components/assistant/AssistantDock");
  const container = document.createElement("div") as unknown as TestElement;
  const root = createRoot(container as unknown as Element);

  await act(async () => {
    root.render(<AssistantDock />);
    await flushEffects();
  });

  if (!dockPanelProps) {
    throw new Error("Assistant panel props were not captured");
  }

  return { root };
}

async function setDockInputValue(value: string) {
  await act(async () => {
    dockPanelProps?.onInputChange(value);
    await flushEffects();
  });
}

describe("AssistantPanelView", () => {
  test("renders the panel shell and deterministic price and depth cards", () => {
    const html = renderPanel([
      {
        type: "price",
        assetLabel: "TBILL",
        primaryPrice: unitPriceFromSharePriceCents(12_500n),
        bestAsk: unitPriceFromSharePriceCents(12_700n),
        bestBid: unitPriceFromSharePriceCents(12_200n),
      },
      {
        type: "depth",
        assetLabel: "TBILL",
        asks: [{ price: unitPriceFromSharePriceCents(12_700n), size: 250n }],
        bids: [{ price: unitPriceFromSharePriceCents(12_200n), size: 175n }],
      },
    ]);

    expect(html).toContain("NL ASSISTANT");
    expect(html).toContain("CONTEXT TBILL");
    expect(html).toContain("Type / for commands, or ask in plain English.");
    expect(html).toContain("PRICE / TBILL");
    expect(html).toContain("PRIMARY");
    expect(html).toContain("125.00 USDC");
    expect(html).toContain("LOWEST ASK");
    expect(html).toContain("127.00 USDC");
    expect(html).toContain("HIGHEST BID");
    expect(html).toContain("122.00 USDC");
    expect(html).toContain("DEPTH / TBILL");
    expect(html).toContain("ASKS");
    expect(html).toContain("2.50");
    expect(html).toContain("BIDS");
    expect(html).toContain("1.75");
  });

  test("shows slash commands, filters by query, and hides commands for natural language", () => {
    const allCommands = renderPanel([], { inputValue: "/" });
    const sellOnly = renderPanel([], { inputValue: "/se" });
    const naturalLanguage = renderPanel([], { inputValue: "buy 5 HADRON" });

    expect(allCommands).toContain("role=\"listbox\"");
    expect(allCommands).toContain("/price");
    expect(allCommands).toContain("/claim");
    expect(sellOnly).toContain("/sell");
    expect(sellOnly).toContain("list shares for sale");
    expect(sellOnly).not.toContain("/buy");
    expect(naturalLanguage).not.toContain("role=\"listbox\"");
  });

  test("portals the open panel to document body with slash commands visible there", async () => {
    const cleanupDom = installDom();
    let root: Root | null = null;

    try {
      const mounted = await mountPanel({ inputValue: "/" });
      root = mounted.root;
      const body = documentBody();

      expect(findElements(mounted.container, (element) => element.tagName === "ASIDE")).toHaveLength(0);
      expect(findElements(mounted.container, (element) => attr(element, "role") === "listbox")).toHaveLength(0);
      expect(findElements(body, (element) => element.tagName === "ASIDE")).toHaveLength(1);
      expect(findElements(body, (element) => attr(element, "role") === "listbox")).toHaveLength(1);
      expect(findElements(body, (element) => attr(element, "data-command") === "price")).toHaveLength(1);
    } finally {
      if (root) {
        await unmount(root);
      }

      cleanupDom();
    }
  });

  test("focuses the assistant input when the panel opens", async () => {
    const cleanupDom = installDom();
    let root: Root | null = null;

    try {
      const container = document.createElement("div") as unknown as TestElement;
      root = createRoot(container as unknown as Element);

      await act(async () => {
        root?.render(<AssistantPanelView {...panelProps({ isOpen: false })} />);
        await flushEffects();
      });

      expect(findElements(documentBody(), (element) => element.tagName === "INPUT")).toHaveLength(0);
      expect((document as unknown as TestDocument).activeElement).toBeNull();

      await act(async () => {
        root?.render(<AssistantPanelView {...panelProps({ isOpen: true })} />);
        await flushEffects();
      });

      const input = findElements(documentBody(), (element) => element.tagName === "INPUT")[0];

      expect((document as unknown as TestDocument).activeElement).toBe(input);
    } finally {
      if (root) {
        await unmount(root);
      }

      cleanupDom();
    }
  });

  test("moves command highlight with arrow keys and inserts the selected template on enter", async () => {
    const cleanupDom = installDom();
    let root: Root | null = null;

    try {
      const onInputChange = vi.fn();
      const mounted = await mountPanel({ inputValue: "/", onInputChange });
      root = mounted.root;
      const body = documentBody();

      const input = findElements(body, (element) => element.tagName === "INPUT")[0];
      const options = () =>
        findElements(body, (element) => attr(element, "role") === "option");

      expect(options().map((option) => attr(option, "data-command"))).toEqual([
        "price",
        "depth",
        "holdings",
        "yield",
        "buy",
        "sell",
        "cancel",
        "claim",
      ]);
      expect(attr(options()[0], "aria-selected")).toBe("true");

      await act(async () => {
        input.dispatchEvent(keyEvent("ArrowUp"));
        await flushEffects();
      });

      expect(attr(options()[0], "aria-selected")).toBe("true");

      await act(async () => {
        input.dispatchEvent(keyEvent("ArrowDown"));
        await flushEffects();
      });

      expect(attr(options()[1], "aria-selected")).toBe("true");

      await act(async () => {
        input.dispatchEvent(keyEvent("Enter"));
        await flushEffects();
      });

      expect(onInputChange).toHaveBeenCalledWith("depth <asset>");
      await act(async () => {
        root?.render(<AssistantPanelView {...panelProps({ inputValue: "depth <asset>", onInputChange })} />);
        await flushEffects();
      });

      expect(findElements(body, (element) => attr(element, "role") === "listbox")).toHaveLength(0);
      expect((document as unknown as TestDocument).activeElement).toBe(input);
    } finally {
      if (root) {
        await unmount(root);
      }

      cleanupDom();
    }
  });

  test("reopens command menu after selecting a template and typing slash again", async () => {
    const cleanupDom = installDom();
    let root: Root | null = null;

    try {
      const onInputChange = vi.fn();
      const container = document.createElement("div") as unknown as TestElement;
      root = createRoot(container as unknown as Element);
      const renderWithInput = async (inputValue: string) => {
        await act(async () => {
          root?.render(<AssistantPanelView {...panelProps({ inputValue, onInputChange })} />);
          await flushEffects();
        });
      };

      await renderWithInput("/");
      const body = documentBody();
      const input = findElements(body, (element) => element.tagName === "INPUT")[0];
      const listboxes = () => findElements(body, (element) => attr(element, "role") === "listbox");

      expect(listboxes()).toHaveLength(1);

      await act(async () => {
        input.dispatchEvent(keyEvent("Enter"));
        await flushEffects();
      });

      expect(onInputChange).toHaveBeenLastCalledWith("price <asset>");

      await renderWithInput("price <asset>");
      expect(listboxes()).toHaveLength(0);

      await renderWithInput("");
      expect(listboxes()).toHaveLength(0);

      await renderWithInput("/");

      expect(listboxes()).toHaveLength(1);
      expect(findElements(body, (element) => attr(element, "data-command") === "price")).toHaveLength(1);
    } finally {
      if (root) {
        await unmount(root);
      }

      cleanupDom();
    }
  });

  test("selects the first placeholder after inserting a command template", async () => {
    const cleanupDom = installDom();
    let root: Root | null = null;

    try {
      const onInputChange = vi.fn();
      const container = document.createElement("div") as unknown as TestElement;
      root = createRoot(container as unknown as Element);
      const renderWithInput = async (inputValue: string) => {
        await act(async () => {
          root?.render(<AssistantPanelView {...panelProps({ inputValue, onInputChange })} />);
          await flushEffects();
        });
      };

      await renderWithInput("/");
      const body = documentBody();
      const input = findElements(body, (element) => element.tagName === "INPUT")[0];

      await act(async () => {
        input.dispatchEvent(keyEvent("Enter"));
        await flushEffects();
      });

      expect(onInputChange).toHaveBeenLastCalledWith("price <asset>");

      await renderWithInput("price <asset>");

      const selectedInput = findElements(body, (element) => element.tagName === "INPUT")[0];

      expect(selectedInput.value).toBe("price <asset>");
      expect(selectedInput.selectionStart).toBe(6);
      expect(selectedInput.selectionEnd).toBe(13);
    } finally {
      if (root) {
        await unmount(root);
      }

      cleanupDom();
    }
  });

  test("places the cursor at the end when a command template has no placeholder", async () => {
    const cleanupDom = installDom();
    let root: Root | null = null;

    try {
      const onInputChange = vi.fn();
      const container = document.createElement("div") as unknown as TestElement;
      root = createRoot(container as unknown as Element);
      const renderWithInput = async (inputValue: string) => {
        await act(async () => {
          root?.render(<AssistantPanelView {...panelProps({ inputValue, onInputChange })} />);
          await flushEffects();
        });
      };

      await renderWithInput("/cl");
      const body = documentBody();
      const input = findElements(body, (element) => element.tagName === "INPUT")[0];

      await act(async () => {
        input.dispatchEvent(keyEvent("Enter"));
        await flushEffects();
      });

      expect(onInputChange).toHaveBeenLastCalledWith("claim my yield");

      await renderWithInput("claim my yield");

      const selectedInput = findElements(body, (element) => element.tagName === "INPUT")[0];

      expect(selectedInput.value).toBe("claim my yield");
      expect(selectedInput.selectionStart).toBe("claim my yield".length);
      expect(selectedInput.selectionEnd).toBe("claim my yield".length);
    } finally {
      if (root) {
        await unmount(root);
      }

      cleanupDom();
    }
  });

  test("clamps command navigation at the last item before selecting", async () => {
    const cleanupDom = installDom();
    let root: Root | null = null;

    try {
      const onInputChange = vi.fn();
      const mounted = await mountPanel({ inputValue: "/", onInputChange });
      root = mounted.root;
      const body = documentBody();

      const input = findElements(body, (element) => element.tagName === "INPUT")[0];
      const options = () =>
        findElements(body, (element) => attr(element, "role") === "option");

      expect(options()).toHaveLength(8);

      await act(async () => {
        for (let index = 0; index < 12; index += 1) {
          input.dispatchEvent(keyEvent("ArrowDown"));
        }

        await flushEffects();
      });

      const lastOption = options()[options().length - 1];

      expect(attr(lastOption, "data-command")).toBe("claim");
      expect(attr(lastOption, "aria-selected")).toBe("true");

      await act(async () => {
        input.dispatchEvent(keyEvent("Enter"));
        await flushEffects();
      });

      expect(onInputChange).toHaveBeenCalledWith("claim my yield");
    } finally {
      if (root) {
        await unmount(root);
      }

      cleanupDom();
    }
  });

  test("esc closes the command menu without changing input text", async () => {
    const cleanupDom = installDom();
    let root: Root | null = null;

    try {
      const onInputChange = vi.fn();
      const mounted = await mountPanel({ inputValue: "/", onInputChange });
      root = mounted.root;
      const body = documentBody();

      const input = findElements(body, (element) => element.tagName === "INPUT")[0];

      await act(async () => {
        input.dispatchEvent(keyEvent("Escape"));
        await flushEffects();
      });

      expect(onInputChange).not.toHaveBeenCalled();
      expect((input as unknown as HTMLInputElement).value).toBe("/");
      expect(findElements(body, (element) => attr(element, "role") === "listbox")).toHaveLength(0);
    } finally {
      if (root) {
        await unmount(root);
      }

      cleanupDom();
    }
  });

  test("keeps natural-language submit on the existing assistant pipeline", async () => {
    const cleanupDom = installDom();
    let root: Root | null = null;

    try {
      const onSubmit = vi.fn();
      const mounted = await mountPanel({ inputValue: "buy 5 HADRON", onSubmit });
      root = mounted.root;
      const body = documentBody();
      const form = findElements(body, (element) => element.tagName === "FORM")[0];

      expect(findElements(body, (element) => attr(element, "role") === "listbox")).toHaveLength(0);

      await act(async () => {
        form.dispatchEvent(submitEvent());
        await flushEffects();
      });

      expect(onSubmit).toHaveBeenCalledTimes(1);
    } finally {
      if (root) {
        await unmount(root);
      }

      cleanupDom();
    }
  });

  test("clears the dock input after a successful intent submit", async () => {
    const cleanupDom = installDom();
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ kind: "unknown" }), {
        headers: { "content-type": "application/json" },
        status: 200,
      }),
    );
    const cleanupFetch = installFetch(fetchMock as unknown as typeof fetch);
    let root: Root | null = null;

    try {
      const mounted = await mountDockWithPanelMock();
      root = mounted.root;

      await setDockInputValue("show me prices");
      expect(dockPanelProps?.inputValue).toBe("show me prices");

      await act(async () => {
        dockPanelProps?.onSubmit();
        await flushEffects();
        await flushEffects();
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(dockPanelProps?.inputValue).toBe("");
    } finally {
      if (root) {
        await unmount(root);
      }

      cleanupFetch();
      cleanupDom();
      vi.doUnmock("@/components/assistant/AssistantPanel");
    }
  });

  test("keeps assistant market reads disabled while the dock is closed", async () => {
    const cleanupDom = installDom();
    let root: Root | null = null;

    try {
      const mounted = await mountDockWithPanelMock();
      root = mounted.root;

      expect(dockPanelProps?.isOpen).toBe(false);
      expect(useAssetsMock).toHaveBeenLastCalledWith({ enabled: false });
      expect(useAllListingsMock).toHaveBeenLastCalledWith({ enabled: false });
      expect(useAllBidsMock).toHaveBeenLastCalledWith({ enabled: false });
      expect(usePortfolioMock).toHaveBeenLastCalledWith({ enabled: false });
    } finally {
      if (root) {
        await unmount(root);
      }

      cleanupDom();
      vi.doUnmock("@/components/assistant/AssistantPanel");
    }
  });

  test("keeps the dock input after a failed intent response", async () => {
    const cleanupDom = installDom();
    const fetchMock = vi.fn(async () => new Response(null, { status: 500 }));
    const cleanupFetch = installFetch(fetchMock as unknown as typeof fetch);
    let root: Root | null = null;

    try {
      const mounted = await mountDockWithPanelMock();
      root = mounted.root;

      await setDockInputValue("show me prices");
      expect(dockPanelProps?.inputValue).toBe("show me prices");

      await act(async () => {
        dockPanelProps?.onSubmit();
        await flushEffects();
        await flushEffects();
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(dockPanelProps?.inputValue).toBe("show me prices");
    } finally {
      if (root) {
        await unmount(root);
      }

      cleanupFetch();
      cleanupDom();
      vi.doUnmock("@/components/assistant/AssistantPanel");
    }
  });

  test("renders holdings and yield cards from deterministic values", () => {
    const html = renderPanel([
      {
        type: "holdings",
        isConnected: false,
        rows: [],
      },
      {
        type: "yield",
        isConnected: true,
        totalPending: 3n * USDC,
        rows: [{ assetLabel: "TBILL", pending: 3n * USDC }],
      },
    ]);

    expect(html).toContain("Connect wallet to view your holdings");
    expect(html).toContain("YIELD");
    expect(html).toContain("UNCLAIMED TOTAL");
    expect(html).toContain("3.00 USDC");
    expect(html).toContain("TBILL");
  });

  test("renders unknown and asset clarification cards without transaction actions", () => {
    const html = renderPanel([
      { type: "unknown" },
      {
        type: "asset_ambiguous",
        query: "treasury",
        candidates: [
          { tokenId: 1n, label: "Hadron Alpha Treasury", ticker: "HADRON" },
          { tokenId: 4n, label: "Hadron Beta Treasury", ticker: "HBETA" },
        ],
      },
      { type: "asset_not_found", query: "banana futures" },
    ]);

    expect(html).toContain(
      "I can help with prices, depth, holdings, yield, buying, selling, cancelling orders, and claiming yield.",
    );
    expect(html).toContain("CLARIFY ASSET");
    expect(html).toContain("Hadron Alpha Treasury");
    expect(html).toContain("TOKEN #1");
    expect(html).toContain("Asset not found");
    expect(html).not.toContain("Confirm");
  });

  test("renders sell, cancel, and claim write-action cards", () => {
    const html = renderPanel([
      {
        type: "sell",
        assetLabel: "HADRON",
        balance: 500n,
        errorText: undefined,
        isConnected: true,
        isCorrectChain: true,
        onConnect: () => undefined,
        onListForSale: () => undefined,
        onSwitchNetwork: () => undefined,
        price: 2.1,
        quantity: 2.5,
        status: "idle",
        tokenId: 7n,
        txHash: undefined,
      },
      {
        type: "cancel",
        assetLabel: "HADRON",
        errorText: undefined,
        isConnected: true,
        isCorrectChain: true,
        onCancelBid: () => undefined,
        onCancelListing: () => undefined,
        onConnect: () => undefined,
        onSwitchNetwork: () => undefined,
        orders: [
          { side: "listing", id: 4n, price: unitPriceFromSharePriceCents(210n), size: 250n },
          { side: "bid", id: 9n, price: unitPriceFromSharePriceCents(190n), size: 125n },
        ],
        status: "idle",
        txHash: undefined,
      },
      {
        type: "claim",
        entries: [{ tokenId: 7n, assetLabel: "HADRON", amount: 250n * (USDC / 100n) }],
        errorText: undefined,
        isConnected: true,
        isCorrectChain: true,
        mode: "single",
        onClaim: () => undefined,
        onClaimBatch: () => undefined,
        onConnect: () => undefined,
        onSwitchNetwork: () => undefined,
        status: "idle",
        txHash: undefined,
      },
    ]);

    expect(html).toContain("SELL / HADRON");
    expect(html).toContain("CANCEL / HADRON");
    expect(html).toContain("LISTING #4");
    expect(html).toContain("BID #9");
    expect(html).toContain("CLAIM / HADRON");
    expect(html).toContain("2.50 USDC");
  });
});
