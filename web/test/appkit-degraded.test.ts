import { describe, expect, test, vi } from "vitest";

describe("Reown AppKit degraded configuration", () => {
  test("does not create AppKit when WalletConnect project id is not configured", async () => {
    const createAppKit = vi.fn();

    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID", "");
    vi.doMock("@reown/appkit/react", () => ({
      createAppKit,
      useAppKit: () => ({ open: vi.fn() }),
    }));

    const appkit = await import("../lib/appkit");

    expect(appkit.appKitProjectId).toBeUndefined();
    expect(appkit.isAppKitConfigured).toBe(false);
    expect(appkit.createHadronAppKit([] as never)).toBeNull();
    expect(createAppKit).not.toHaveBeenCalled();

    vi.doUnmock("@reown/appkit/react");
    vi.unstubAllEnvs();
  });
});
