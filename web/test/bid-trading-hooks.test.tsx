import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { HADRON_ASSETS_ADDRESS, HADRON_MARKET_ADDRESS } from "../lib/contracts";

const ADDRESS = "0x1111111111111111111111111111111111111111" as `0x${string}`;
const TX_HASH = "0x00000000000000000000000000000000000000000000000000000000000000ab" as `0x${string}`;
const APPROVE_HASH = "0x00000000000000000000000000000000000000000000000000000000000000ac" as `0x${string}`;

const mockState = vi.hoisted(() => ({
  address: "0x1111111111111111111111111111111111111111" as `0x${string}` | undefined,
  approvalResult: { data: true, isError: false, error: undefined as unknown },
  isReceiptError: false,
  readContractCalls: [] as unknown[],
  receiptError: undefined as unknown,
  receiptStatus: undefined as "success" | "reverted" | undefined,
  waitReceiptCalls: [] as unknown[],
  writeContract: vi.fn(),
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({
    address: mockState.address,
  }),
  useReadContract: (input: unknown) => {
    mockState.readContractCalls.push(input);

    return {
      refetch: vi.fn().mockResolvedValue(mockState.approvalResult),
    };
  },
  useWaitForTransactionReceipt: (input: unknown) => {
    mockState.waitReceiptCalls.push(input);

    return {
      data: mockState.receiptStatus ? { status: mockState.receiptStatus } : undefined,
      error: mockState.receiptError,
      isError: mockState.isReceiptError,
    };
  },
  useWriteContract: () => ({
    writeContract: mockState.writeContract,
  }),
}));

async function flushEffects() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

// ReactDOM 挂载 hooks 只需要这些最小 DOM 能力。
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

async function mountHook<T>(useHook: () => T) {
  let current: T | null = null;
  const container = document.createElement("div");
  const root = createRoot(container);

  function HookHost() {
    current = useHook();

    return null;
  }

  async function render() {
    await act(async () => {
      root.render(<HookHost />);
      await flushEffects();
    });
  }

  await render();

  if (!current) {
    throw new Error("Hook did not render");
  }

  return {
    get current() {
      return current as T;
    },
    render,
    root,
  };
}

describe("bid trading hooks", () => {
  let cleanupDom: () => void;
  let root: Root | null;

  beforeEach(() => {
    cleanupDom = installDom();
    root = null;
    mockState.address = ADDRESS;
    mockState.approvalResult = { data: true, isError: false, error: undefined };
    mockState.isReceiptError = false;
    mockState.readContractCalls = [];
    mockState.receiptError = undefined;
    mockState.receiptStatus = undefined;
    mockState.waitReceiptCalls = [];
    mockState.writeContract = vi.fn();
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
        await flushEffects();
      });
    }

    cleanupDom();
  });

  test("usePlaceBid writes placeBid with escrow value and maps wallet cancellation", async () => {
    const mod = await import("../lib/hooks/usePlaceBid");
    const mounted = await mountHook(() => mod.usePlaceBid());
    root = mounted.root;

    await act(async () => {
      mounted.current.placeBid(7n, 250n, 12n, 3_000n);
      await flushEffects();
    });

    expect(mockState.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: HADRON_MARKET_ADDRESS,
        args: [7n, 250n, 12n],
        functionName: "placeBid",
        value: 3_000n,
      }),
      expect.objectContaining({
        onError: expect.any(Function),
        onSuccess: expect.any(Function),
      }),
    );

    const callbacks = mockState.writeContract.mock.calls[0][1] as {
      onError: (err: unknown) => void;
    };

    await act(async () => {
      callbacks.onError({ name: "UserRejectedRequestError" });
      await flushEffects();
    });

    expect(mounted.current.status).toBe("error");
    expect(mounted.current.errorText).toBe("Signature cancelled");
  });

  test("useCancelBid writes cancelBid and stores the pending transaction hash", async () => {
    const mod = await import("../lib/hooks/useCancelBid");
    const mounted = await mountHook(() => mod.useCancelBid());
    root = mounted.root;

    await act(async () => {
      mounted.current.cancelBid(4n);
      await flushEffects();
    });

    expect(mockState.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: HADRON_MARKET_ADDRESS,
        args: [4n],
        functionName: "cancelBid",
      }),
      expect.objectContaining({
        onSuccess: expect.any(Function),
      }),
    );

    const callbacks = mockState.writeContract.mock.calls[0][1] as {
      onSuccess: (hash: `0x${string}`) => void;
    };

    await act(async () => {
      callbacks.onSuccess(TX_HASH);
      await flushEffects();
    });

    expect(mounted.current.status).toBe("pending");
    expect(mounted.current.txHash).toBe(TX_HASH);
  });

  test("useFillBid fills immediately when the asset transfer approval already exists", async () => {
    const mod = await import("../lib/hooks/useFillBid");
    const mounted = await mountHook(() => mod.useFillBid());
    root = mounted.root;

    await act(async () => {
      mounted.current.fillBid(8n, 125n);
      await flushEffects();
    });

    expect(mockState.readContractCalls[0]).toMatchObject({
      address: HADRON_ASSETS_ADDRESS,
      args: [ADDRESS, HADRON_MARKET_ADDRESS],
      functionName: "isApprovedForAll",
    });
    expect(mockState.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: HADRON_MARKET_ADDRESS,
        args: [8n, 125n],
        functionName: "fillBid",
      }),
      expect.any(Object),
    );
  });

  test("useFillBid approves asset transfer before filling an unapproved bid", async () => {
    mockState.approvalResult = { data: false, isError: false, error: undefined };
    const mod = await import("../lib/hooks/useFillBid");
    const mounted = await mountHook(() => mod.useFillBid());
    root = mounted.root;

    await act(async () => {
      mounted.current.fillBid(9n, 200n);
      await flushEffects();
    });

    expect(mockState.writeContract).toHaveBeenCalledTimes(1);
    expect(mockState.writeContract).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        address: HADRON_ASSETS_ADDRESS,
        args: [HADRON_MARKET_ADDRESS, true],
        functionName: "setApprovalForAll",
      }),
      expect.any(Object),
    );

    const approveCallbacks = mockState.writeContract.mock.calls[0][1] as {
      onSuccess: (hash: `0x${string}`) => void;
    };

    await act(async () => {
      approveCallbacks.onSuccess(APPROVE_HASH);
      await flushEffects();
    });

    mockState.receiptStatus = "success";
    await mounted.render();

    expect(mockState.writeContract).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        address: HADRON_MARKET_ADDRESS,
        args: [9n, 200n],
        functionName: "fillBid",
      }),
      expect.any(Object),
    );
    expect(mounted.current.approveTxHash).toBe(APPROVE_HASH);
  });
});
