import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { ClaimConfirmCard, submitClaimConfirmation } from "../components/assistant/ClaimConfirmCard";

const USDC = 10n ** 18n;

const singleEntry = [{ tokenId: 7n, assetLabel: "HADRON", amount: 250n * (USDC / 100n) }];
const batchEntries = [
  { tokenId: 7n, assetLabel: "HADRON", amount: 2n * USDC },
  { tokenId: 8n, assetLabel: "TBILL", amount: 350n * (USDC / 100n) },
];

function renderCard(overrides: Partial<Parameters<typeof ClaimConfirmCard>[0]> = {}) {
  return renderToStaticMarkup(
    <ClaimConfirmCard
      entries={singleEntry}
      errorText={undefined}
      isConnected
      isCorrectChain
      mode="single"
      onClaim={() => undefined}
      onClaimBatch={() => undefined}
      onConnect={() => undefined}
      onSwitchNetwork={() => undefined}
      status="idle"
      txHash={undefined}
      {...overrides}
    />,
  );
}

describe("ClaimConfirmCard", () => {
  test("renders a single asset claim and routes to claimYield", () => {
    const onClaim = vi.fn();
    const onClaimBatch = vi.fn();
    const html = renderCard({ onClaim, onClaimBatch });

    submitClaimConfirmation({
      entries: singleEntry,
      isConnected: true,
      isCorrectChain: true,
      mode: "single",
      onClaim,
      onClaimBatch,
      onConnect: vi.fn(),
      onSwitchNetwork: vi.fn(),
      status: "idle",
    });

    expect(html).toContain("CLAIM / HADRON");
    expect(html).toContain("2.50 USDC");
    expect(onClaim).toHaveBeenCalledWith(7n);
    expect(onClaimBatch).not.toHaveBeenCalled();
  });

  test("renders a batch claim summary and routes to claimYieldBatch", () => {
    const onClaim = vi.fn();
    const onClaimBatch = vi.fn();
    const html = renderCard({ entries: batchEntries, mode: "batch", onClaim, onClaimBatch });

    submitClaimConfirmation({
      entries: batchEntries,
      isConnected: true,
      isCorrectChain: true,
      mode: "batch",
      onClaim,
      onClaimBatch,
      onConnect: vi.fn(),
      onSwitchNetwork: vi.fn(),
      status: "idle",
    });

    expect(html).toContain("CLAIM / ALL YIELD");
    expect(html).toContain("HADRON");
    expect(html).toContain("TBILL");
    expect(html).toContain("5.50 USDC");
    expect(onClaim).not.toHaveBeenCalled();
    expect(onClaimBatch).toHaveBeenCalledWith([7n, 8n]);
  });

  test("renders a nothing-to-claim fallback and avoids submitting", () => {
    const onClaim = vi.fn();
    const onClaimBatch = vi.fn();
    const html = renderCard({ entries: [], onClaim, onClaimBatch });

    submitClaimConfirmation({
      entries: [],
      isConnected: true,
      isCorrectChain: true,
      mode: "single",
      onClaim,
      onClaimBatch,
      onConnect: vi.fn(),
      onSwitchNetwork: vi.fn(),
      status: "idle",
    });

    expect(html).toContain("Nothing to claim");
    expect(onClaim).not.toHaveBeenCalled();
    expect(onClaimBatch).not.toHaveBeenCalled();
  });

  test("uses wallet and network guards before attempting a claim", () => {
    const onConnect = vi.fn();
    const onSwitchNetwork = vi.fn();
    const onClaim = vi.fn();
    const onClaimBatch = vi.fn();

    submitClaimConfirmation({
      entries: singleEntry,
      isConnected: false,
      isCorrectChain: true,
      mode: "single",
      onClaim,
      onClaimBatch,
      onConnect,
      onSwitchNetwork,
      status: "idle",
    });
    submitClaimConfirmation({
      entries: batchEntries,
      isConnected: true,
      isCorrectChain: false,
      mode: "batch",
      onClaim,
      onClaimBatch,
      onConnect,
      onSwitchNetwork,
      status: "idle",
    });

    expect(onConnect).toHaveBeenCalledOnce();
    expect(onSwitchNetwork).toHaveBeenCalledOnce();
    expect(onClaim).not.toHaveBeenCalled();
    expect(onClaimBatch).not.toHaveBeenCalled();
  });
});
