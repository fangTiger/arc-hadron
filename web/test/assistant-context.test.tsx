import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { AssetView } from "../lib/mappers";
import {
  assistantDefaultAssetForPath,
  buildAssistantIntentRequest,
} from "../lib/ai/assistantContext";

const pathnameMock = vi.hoisted(() => vi.fn(() => "/asset/15"));

vi.mock("next/navigation", () => ({
  usePathname: pathnameMock,
}));

vi.mock("@/lib/hooks/useNetworkGuard", () => ({
  useNetworkGuard: () => ({
    isConnected: false,
    isCorrectChain: true,
    switchToArc: vi.fn(),
  }),
}));

vi.mock("@/components/layout/WalletButton", () => ({
  WalletButton: () => <button type="button">CONNECT WALLET</button>,
}));

vi.mock("@/components/assistant/AssistantDock", () => ({
  AssistantDock: () => <button type="button">ASSISTANT</button>,
}));

import { TopBar } from "../components/layout/TopBar";

function assetView(overrides: Partial<AssetView> = {}): AssetView {
  return {
    category: "treasuries",
    meta: {
      apyBps: 525,
      description: "Short-duration Treasury exposure.",
      displayName: "US T-Bill 2026-Q3",
      docs: [],
      issuer: "Hadron Treasury Desk",
      slug: "t-bill-2026-q3",
      ticker: "TBILL",
    },
    name: "US T-BILL 2026-Q3",
    offering: null,
    tokenId: 15n,
    totalShares: 10_000n,
    ...overrides,
  };
}

describe("assistant asset context", () => {
  test("uses the current asset page as the default asset for omitted-asset commands", () => {
    const currentAsset = assetView();
    const defaultAsset = assistantDefaultAssetForPath("/asset/15", [currentAsset]);

    expect(defaultAsset).toBe(currentAsset);
    expect(buildAssistantIntentRequest("buy 5", defaultAsset)).toEqual({
      message: "buy 5",
      defaultAsset: "TBILL",
    });
  });

  test("omits defaultAsset outside asset pages or when the token is unknown", () => {
    expect(assistantDefaultAssetForPath("/", [assetView()])).toBeNull();
    expect(assistantDefaultAssetForPath("/asset/999", [assetView()])).toBeNull();
    expect(buildAssistantIntentRequest("buy 5", null)).toEqual({ message: "buy 5" });
  });

  test("mounts the assistant entry in the top bar", () => {
    pathnameMock.mockReturnValue("/");

    const html = renderToStaticMarkup(<TopBar />);

    expect(html).toContain("ASSISTANT");
  });
});
