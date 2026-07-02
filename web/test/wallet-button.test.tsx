import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { WalletButton, WalletButtonView, openWalletModal } from "../components/layout/WalletButton";

describe("WalletButton Reown integration", () => {
  test("opens the AppKit modal from the disconnected call to action", async () => {
    const open = vi.fn().mockResolvedValue(undefined);
    const setNotice = vi.fn();

    await openWalletModal(open, setNotice);

    expect(setNotice).toHaveBeenCalledWith(null);
    expect(open).toHaveBeenCalledOnce();
  });

  test("renders the existing disconnected button instead of the AppKit web component", () => {
    const html = renderToStaticMarkup(
      <WalletButtonView
        address={undefined}
        isConnected={false}
        isOpen={false}
        isPending={false}
        notice={null}
        onCopyAddress={() => undefined}
        onDisconnect={() => undefined}
        onOpenWallet={() => undefined}
        onToggleMenu={() => undefined}
      />,
    );

    expect(html).toContain("CONNECT WALLET");
    expect(html).not.toContain("appkit-button");
  });

  test("server-renders without calling the AppKit hook before client initialization", () => {
    const html = renderToStaticMarkup(<WalletButton />);

    expect(html).toContain("CONNECT WALLET");
  });
});
