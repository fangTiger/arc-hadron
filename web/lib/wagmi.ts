import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { http } from "wagmi";
import { appKitNetworks, appKitProjectId } from "./appkit";
import { arcTestnet, ARC_RPC_URL } from "./chain";

export const wagmiAdapter = new WagmiAdapter({
  networks: appKitNetworks,
  projectId: appKitProjectId,
  transports: {
    [arcTestnet.id]: http(ARC_RPC_URL),
  },
  ssr: true,
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;
