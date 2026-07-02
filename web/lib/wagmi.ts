import { createConfig, http } from "wagmi";
import { injected, walletConnect } from "wagmi/connectors";
import { arcTestnet, ARC_RPC_URL } from "./chain";
import { optionalPublicEnv } from "./env";

const walletConnectProjectId = optionalPublicEnv(
  "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID",
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
);

const connectors = walletConnectProjectId
  ? [injected(), walletConnect({ projectId: walletConnectProjectId })]
  : [injected()];

export const wagmiConfig = createConfig({
  chains: [arcTestnet],
  connectors,
  transports: {
    [arcTestnet.id]: http(ARC_RPC_URL),
  },
  ssr: true,
});
