import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { createConfig, http, injected } from "wagmi";
import { appKitNetworks, appKitProjectId, createHadronAppKit } from "./appkit";
import { arcTestnet, ARC_RPC_URL } from "./chain";

export const wagmiAdapter = appKitProjectId
  ? new WagmiAdapter({
      networks: appKitNetworks,
      projectId: appKitProjectId,
      transports: {
        [arcTestnet.id]: http(ARC_RPC_URL),
      },
      ssr: true,
    })
  : null;

export const wagmiConfig =
  wagmiAdapter?.wagmiConfig ??
  createConfig({
    chains: [arcTestnet],
    connectors: [injected()],
    transports: {
      [arcTestnet.id]: http(ARC_RPC_URL),
    },
    ssr: true,
  });

let hadronAppKitInitialized = false;

export function initializeHadronAppKit(): boolean {
  if (hadronAppKitInitialized) {
    return true;
  }

  if (!wagmiAdapter) {
    return false;
  }

  hadronAppKitInitialized = createHadronAppKit([wagmiAdapter]) !== null;

  return hadronAppKitInitialized;
}
