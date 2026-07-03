# HADRON

HADRON is an RWA exchange on Arc testnet: primary issuance and a secondary listing market, settled in native USDC.

## Architecture

HADRON is split into a small Foundry contract system, a Next.js market interface, and seed scripts that create testnet market depth.

```text
contracts/                                   web/
  Foundry                                      Next.js 16
  HadronAssets ERC1155                         wagmi + viem
  HadronMarket                                 lightweight-charts
    - primary offerings                          |
    - secondary listings                         |
    - 0.5% protocol fee                          v
         |                              event layer
         |                              chunked scans -> decode -> dedupe
         |                              block timestamps -> localStorage cache
         v
contracts/script/
  SeedV3         reissues the active catalog as tokenId 15-28
  SeedTrades     creates primary-market trade events
  SeedSecondary  creates listings and secondary trade events
```

The active V3 catalog uses `SHARE_SCALE=100`: 1 displayed share equals 100 on-chain units, so the UI and scripts support 0.01 share granularity.

## On-Chain Verifiability

Source of truth: `contracts/deployments/arc-testnet.json`.

| Item | Value |
| --- | --- |
| Chain ID | `5042002` |
| RPC | `https://rpc.testnet.arc.network` |
| Explorer | `https://testnet.arcscan.app` |
| `HadronAssets` | `0x4D82b6e528D3c2E1a3592e14863ec95EAeF4Ff85` |
| `HadronMarket` | `0x962aba0A590981cf9c5B336aC34922c82f203165` |
| Deploy block | `49771985` |
| Active V3 token IDs | `15-28` |
| Native settlement asset | `USDC` |
| Protocol fee | `50 bps` (`0.5%`) |

Acceptance transactions:

- Smoke test primary buy: `0x320fa3fa559739a91dc4298a2bc431682751039ae094d9785f0c1059c5d3bd06`
- User acceptance fractional primary buy: `0xf3b7cc241dbc776955725e84cb77dbd4a750e0c7c18c812fa160c4c5a58539e7`
- User acceptance secondary buy of listing 17: `0x9909b3477393595e70beb076d1474c19bdea4619473fc9c3f23977fa5eea75dd`

## Local Development

Run the web app locally:

```bash
cd web
npm i
npm run dev
```

Create `web/.env.local` with the public client-side variables used by `web/lib/env.ts`, `web/lib/chain.ts`, `web/lib/contracts.ts`, and `web/lib/appkit.ts`:

```text
NEXT_PUBLIC_ARC_CHAIN_ID
NEXT_PUBLIC_ARC_RPC_URL
NEXT_PUBLIC_ARC_EXPLORER_URL
NEXT_PUBLIC_HADRON_ASSETS
NEXT_PUBLIC_HADRON_MARKET
NEXT_PUBLIC_DEPLOY_BLOCK
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
```

Do not put private keys in `web/.env.local`; the web app only consumes `NEXT_PUBLIC_*` values.

Verification commands and current evidence:

```bash
cd contracts && forge test   # 42 Solidity tests
cd web && npm test           # 151 Vitest cases
```

## Project Workflow

HADRON is built with OpenSpec-driven changes, TDD, and multi-AI cross-checking. Specs define the expected capability, tests lock the behavior before implementation, and contract/front-end transaction surfaces are reviewed across agents before acceptance.

## Screenshots

<!-- screenshot: market page -->
