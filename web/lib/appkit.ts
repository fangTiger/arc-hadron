import { createAppKit, type CreateAppKit } from "@reown/appkit/react";
import { defineChain, type AppKitNetwork } from "@reown/appkit/networks";
import { arcTestnet } from "./chain";
import { optionalPublicEnv } from "./env";

export const appKitProjectId = optionalPublicEnv(
  "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID",
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
);
export const isAppKitConfigured = appKitProjectId !== undefined;

export const appKitArcNetwork = defineChain({
  ...arcTestnet,
  chainNamespace: "eip155",
  caipNetworkId: `eip155:${arcTestnet.id}`,
});

export const appKitNetworks: [AppKitNetwork, ...AppKitNetwork[]] = [appKitArcNetwork];

export const appKitMetadata = {
  name: "HADRON",
  description: "Real-World Asset Exchange on Arc",
  url: "http://localhost:3000",
  icons: [],
} satisfies CreateAppKit["metadata"];

export const appKitFeatures = {
  analytics: false,
  email: false,
  socials: false,
} satisfies CreateAppKit["features"];

export const appKitThemeVariables = {
  "--w3m-accent": "#22d3ee",
  "--apkt-accent": "#22d3ee",
  "--w3m-color-mix": "#07111f",
  "--w3m-color-mix-strength": 24,
  "--w3m-border-radius-master": "1px",
  "--w3m-font-family": "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  "--w3m-qr-color": "#22d3ee",
} satisfies CreateAppKit["themeVariables"];

type AppKitAdapters = NonNullable<CreateAppKit["adapters"]>;

export function createHadronAppKit(adapters: AppKitAdapters) {
  if (!appKitProjectId) {
    return null;
  }

  return createAppKit({
    adapters,
    networks: appKitNetworks,
    projectId: appKitProjectId,
    metadata: appKitMetadata,
    features: appKitFeatures,
    themeMode: "dark",
    themeVariables: appKitThemeVariables,
  });
}
