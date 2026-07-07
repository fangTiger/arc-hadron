import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";

const pathnameMock = vi.hoisted(() => vi.fn(() => "/"));

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

import DeveloperApiPage from "../app/developers/api/page";
import { TopBar } from "../components/layout/TopBar";

describe("developer API documentation", () => {
  test("adds an API link to the top navigation", () => {
    const html = renderToStaticMarkup(<TopBar />);

    expect(html).toContain('href="/developers/api"');
    expect(html).toContain(">API</a>");
  });

  test("documents team-issued API keys without an application flow", () => {
    const html = renderToStaticMarkup(<DeveloperApiPage />);

    expect(html).toContain("API keys are issued directly by the HADRON team");
    expect(html).toContain("No public application flow");
    expect(html).toContain("Authorization: Bearer");
  });

  test("shows lightweight REST examples for queries and signed trading boundaries", () => {
    const html = renderToStaticMarkup(<DeveloperApiPage />);

    expect(html).toContain("GET /v1/assets");
    expect(html).toContain("GET /v1/orders/listings");
    expect(html).toContain("GET /v1/orders/bids");
    expect(html).toContain("POST /v1/trades/broadcast");
    expect(html).toContain("caller-signed raw transactions");
  });

  test("documents concrete trading endpoints without becoming a custody API", () => {
    const html = renderToStaticMarkup(<DeveloperApiPage />);

    expect(html).toContain("POST /v1/orders/listings/prepare");
    expect(html).toContain("POST /v1/orders/bids/prepare");
    expect(html).toContain("POST /v1/orders/listings/{listingId}/buy/prepare");
    expect(html).toContain("POST /v1/orders/bids/{bidId}/fill/prepare");
    expect(html).toContain("POST /v1/orders/cancel/prepare");
    expect(html).toContain("POST /v1/trades/broadcast");
    expect(html).toContain("GET /v1/transactions/{txHash}");
    expect(html).toContain("signedTx");
    expect(html).toContain("idempotencyKey");
    expect(html).toContain("calldata");
    expect(html).toContain("422 SIGNATURE_REQUIRED");
  });

  test("marks read-only query APIs as live while keeping trading endpoints as draft", () => {
    const html = renderToStaticMarkup(<DeveloperApiPage />);

    expect(html).toContain("Read-only query APIs are live");
    expect(html).toContain("Trading APIs require issued keys");
  });
});
