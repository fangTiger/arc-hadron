import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { HADRON_YIELD_ADDRESS } from "../lib/contracts";

const ADDRESS = "0x1111111111111111111111111111111111111111" as `0x${string}`;
const TX_HASH = "0x00000000000000000000000000000000000000000000000000000000000000de" as `0x${string}`;

const mockState = vi.hoisted(() => ({
  address: "0x1111111111111111111111111111111111111111" as `0x${string}` | undefined,
  isConnected: true,
  isReceiptError: false,
  readContractsCalls: [] as unknown[],
  readContractsData: [] as unknown[] | undefined,
  receiptError: undefined as unknown,
  receiptStatus: undefined as "success" | "reverted" | undefined,
  waitReceiptCalls: [] as unknown[],
  writeContract: vi.fn(),
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({
    address: mockState.address,
    isConnected: mockState.isConnected,
  }),
  useReadContracts: (input: unknown) => {
    mockState.readContractsCalls.push(input);

    return { data: mockState.readContractsData, isLoading: false };
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
  const queryClient = new QueryClient();

  function HookHost() {
    current = useHook();

    return null;
  }

  async function render() {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <HookHost />
        </QueryClientProvider>,
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
      return current as T;
    },
    render,
    root,
  };
}

describe("yield hooks", () => {
  let cleanupDom: () => void;
  let root: Root | null;

  beforeEach(() => {
    cleanupDom = installDom();
    root = null;
    mockState.address = ADDRESS;
    mockState.isConnected = true;
    mockState.isReceiptError = false;
    mockState.readContractsCalls = [];
    mockState.readContractsData = [];
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

  test("usePendingYield multicalls pendingYield for the connected account", async () => {
    const mod = await import("../lib/hooks/useYield");
    mockState.readContractsData = [12n, 3n];

    const mounted = await mountHook(() => mod.usePendingYield([15n, 16n]));
    root = mounted.root;

    expect(mounted.current.pending.map((item) => `${item.tokenId}:${item.amount}`)).toEqual([
      "15:12",
      "16:3",
    ]);
    expect(mounted.current.pendingByTokenId.get(16n)).toBe(3n);
    expect(mounted.current.totalPending).toBe(15n);
    expect(mockState.readContractsCalls[0]).toMatchObject({
      allowFailure: false,
      contracts: [
        expect.objectContaining({
          address: HADRON_YIELD_ADDRESS,
          args: [ADDRESS, 15n],
          functionName: "pendingYield",
        }),
        expect.objectContaining({
          address: HADRON_YIELD_ADDRESS,
          args: [ADDRESS, 16n],
          functionName: "pendingYield",
        }),
      ],
      query: expect.objectContaining({
        enabled: true,
      }),
    });
  });

  test("usePendingYield returns empty data while disconnected", async () => {
    const mod = await import("../lib/hooks/useYield");
    mockState.address = undefined;
    mockState.isConnected = false;
    mockState.readContractsData = [99n];

    const mounted = await mountHook(() => mod.usePendingYield([15n]));
    root = mounted.root;

    expect(mounted.current.pending).toEqual([]);
    expect(mounted.current.totalPending).toBe(0n);
    expect(mockState.readContractsCalls[0]).toMatchObject({
      contracts: [],
      query: expect.objectContaining({
        enabled: false,
      }),
    });
  });

  test("allows a new submission after a successful receipt without an explicit reset", async () => {
    const mod = await import("../lib/hooks/useYield");
    const mounted = await mountHook(() => mod.useClaimYield());
    root = mounted.root;

    await act(async () => {
      mounted.current.claim(15n);
      await flushEffects();
    });
    const callbacks = mockState.writeContract.mock.calls[0][1] as {
      onSuccess: (hash: `0x${string}`) => void;
    };
    await act(async () => {
      callbacks.onSuccess(TX_HASH);
      mockState.receiptStatus = "success";
      await flushEffects();
    });

    expect(mounted.current.status).toBe("success");

    // 成功态下再次提交视为新会话，不应被静默拦截
    await act(async () => {
      mounted.current.claim(16n);
      await flushEffects();
    });

    expect(mockState.writeContract).toHaveBeenCalledTimes(2);
    expect(mockState.writeContract).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ args: [16n], functionName: "claimYield" }),
      expect.anything(),
    );
  });

  test("useDepositYield writes depositYield with native USDC value and maps cancellation", async () => {
    const mod = await import("../lib/hooks/useYield");
    const mounted = await mountHook(() => mod.useDepositYield());
    root = mounted.root;

    await act(async () => {
      mounted.current.deposit(15n, 12n);
      await flushEffects();
    });

    expect(mockState.writeContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: HADRON_YIELD_ADDRESS,
        args: [15n],
        functionName: "depositYield",
        value: 12n,
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

  test("useClaimYield writes single and batch claims and stores pending hash", async () => {
    const mod = await import("../lib/hooks/useYield");
    const mounted = await mountHook(() => mod.useClaimYield());
    root = mounted.root;

    await act(async () => {
      mounted.current.claim(15n);
      await flushEffects();
    });

    expect(mockState.writeContract).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        address: HADRON_YIELD_ADDRESS,
        args: [15n],
        functionName: "claimYield",
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

    await act(async () => {
      mounted.current.reset();
      await flushEffects();
    });
    await act(async () => {
      mounted.current.claimBatch([15n, 16n]);
      await flushEffects();
    });

    expect(mockState.writeContract).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        address: HADRON_YIELD_ADDRESS,
        args: [[15n, 16n]],
        functionName: "claimYieldBatch",
      }),
      expect.any(Object),
    );
  });
});
