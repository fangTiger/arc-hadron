import { describe, expect, test } from "vitest";
import {
  appKitFeatures,
  appKitMetadata,
  appKitNetworks,
  appKitProjectId,
  appKitThemeVariables,
  isAppKitConfigured,
} from "../lib/appkit";
import { arcTestnet } from "../lib/chain";

describe("Reown AppKit configuration", () => {
  test("uses the public WalletConnect project id from the environment", () => {
    expect(appKitProjectId).toBe("7830285d60949dff7c9f0e7fef9ad970");
    expect(isAppKitConfigured).toBe(true);
  });

  test("defines Arc testnet as an explicit CAIP EVM network", () => {
    const [arc] = appKitNetworks;

    expect(arc.id).toBe(arcTestnet.id);
    expect(arc.chainNamespace).toBe("eip155");
    expect(arc.caipNetworkId).toBe(`eip155:${arcTestnet.id}`);
    expect(arc.rpcUrls.default.http).toEqual(["https://rpc.testnet.arc.network"]);
  });

  test("defines the Arc multicall3 contract for aggregated wagmi reads", () => {
    expect(arcTestnet.contracts?.multicall3).toEqual({
      address: "0xcA11bde05977b3631167028862bE2a173976CA11",
      blockCreated: 0,
    });
  });

  test("keeps the AppKit modal focused on wallet connection only", () => {
    expect(appKitMetadata).toEqual({
      name: "HADRON",
      description: "Real-World Asset Exchange on Arc",
      url: "http://localhost:3000",
      icons: [],
    });
    expect(appKitFeatures).toMatchObject({
      analytics: false,
      email: false,
      socials: false,
    });
    expect(appKitThemeVariables["--w3m-accent"]).toBe("#22d3ee");
  });
});
