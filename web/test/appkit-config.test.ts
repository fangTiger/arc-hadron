import { describe, expect, test } from "vitest";
import {
  appKitFeatures,
  appKitMetadata,
  appKitNetworks,
  appKitProjectId,
  appKitThemeVariables,
} from "../lib/appkit";
import { arcTestnet } from "../lib/chain";

describe("Reown AppKit configuration", () => {
  test("uses the public WalletConnect project id from the environment", () => {
    expect(appKitProjectId).toBe("7830285d60949dff7c9f0e7fef9ad970");
  });

  test("defines Arc testnet as an explicit CAIP EVM network", () => {
    const [arc] = appKitNetworks;

    expect(arc.id).toBe(arcTestnet.id);
    expect(arc.chainNamespace).toBe("eip155");
    expect(arc.caipNetworkId).toBe(`eip155:${arcTestnet.id}`);
    expect(arc.rpcUrls.default.http).toEqual(["https://rpc.testnet.arc.network"]);
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
