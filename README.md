# HADRON

HADRON is an experimental real-world asset exchange built on Arc Testnet. It turns a seeded catalog of tokenized assets into a working on-chain market: primary issuance, secondary listings, buy-side bids, yield distribution, portfolio management, and AI-assisted market workflows, all settled in native USDC.

The project is designed as a community-facing proof of what an Arc-native RWA venue can feel like when the full loop is verifiable on-chain instead of being a front-end mockup.

> Testnet notice: HADRON uses illustrative assets and testnet contracts. It is not an investment product, broker-dealer system, custody product, or financial advice.

## Why HADRON Exists

Stablecoin rails are most useful when they can settle real asset workflows directly. HADRON explores that idea on Arc by combining:

- ERC-1155 asset shares for fractional RWA-style positions.
- Native USDC payments for primary and secondary trades.
- A contract-level market with escrowed listings, escrowed bids, partial fills, cancellations, and a 0.5% protocol fee.
- Yield accounting for asset-level USDC distributions.
- A trading interface that reads from contracts and event logs rather than a private order database.
- AI panels and a natural-language assistant that help users query, buy, sell, cancel, and claim while keeping final transaction parameters deterministic.

## What You Can Do

- Browse a seeded catalog of 14 RWA-style assets across categories such as treasuries, real estate, gold, carbon, and private credit.
- Buy from primary offerings with native USDC on Arc Testnet.
- List shares for resale, buy secondary listings, place bids, fill bids, and cancel open orders.
- Inspect an exchange-style order book with bid/ask ladders, spread, cumulative depth, and recent activity.
- Track wallet holdings, open listings, open bids, average cost, and estimated value.
- Deposit and claim asset-level yield through the `HadronYield` contract.
- Generate on-demand AI market briefs and asset insights from live on-chain snapshots.
- Use the assistant for guarded actions such as `buy`, `sell`, `cancel`, and `claim`; the LLM never receives private keys and does not produce token IDs or final transaction parameters.

## Current Arc Testnet Deployment

The deployment source of truth is [`contracts/deployments/arc-testnet.json`](contracts/deployments/arc-testnet.json).

| Item | Value |
| --- | --- |
| Network | Arc Testnet |
| Chain ID | `5042002` |
| RPC | `https://rpc.testnet.arc.network` |
| Explorer | `https://testnet.arcscan.app` |
| Settlement asset | Native `USDC` |
| On-chain decimals | `18` |
| Deploy block | `50024851` |
| `HadronAssets` | `0xA3d3315Ae24D5047E9fA1736Eb98bebF8fA3fc6F` |
| `HadronMarket` | `0xF5AB3ef3906aA089523Fc63D58d885b60ff58dAc` |
| `HadronYield` | `0x00579D460210Ee74a6547d0144a5eEAF1C799a87` |
| Protocol fee | `50 bps` (`0.5%`) |
| Active seeded catalog | 14 assets, `FIRST_ACTIVE_TOKEN_ID = 1` |

Seeded V6 market state includes 14 primary offerings, 35 secondary listings, 41 bids, 7 bid fills, 3 yield deposits, and 1 sample yield claim. Older deployment addresses are kept in the deployment JSON for audit history only.

Example acceptance transactions:

- Primary buy smoke test: `0x320fa3fa559739a91dc4298a2bc431682751039ae094d9785f0c1059c5d3bd06`
- Fractional primary buy: `0xf3b7cc241dbc776955725e84cb77dbd4a750e0c7c18c812fa160c4c5a58539e7`
- Secondary listing buy: `0x9909b3477393595e70beb076d1474c19bdea4619473fc9c3f23977fa5eea75dd`
- User listing: `0xa6e8874c3b40368e107eef5d6a965c9710c42221f19c1891f28d8b32753b2c2c`
- Listing cancellation: `0x60ed325f4c2991ad0d3d41fc65cc662680cab51716e45765f3e41d507964d7bd`

## Architecture

```text
contracts/
  src/
    HadronAssets.sol    ERC-1155 asset registry and share token
    HadronMarket.sol    Primary offerings, listings, bids, fills, fees
    HadronYield.sol     Asset-level USDC yield accounting and claims
  script/               Deployment and seed scripts
  test/                 Foundry coverage for market, asset, yield, and adversarial flows

web/
  app/                  Next.js App Router pages and API routes
  components/           Market, asset, portfolio, assistant, issuer, and UI surfaces
  lib/                  Contract clients, hooks, event parsing, AI, formatting, order books
```

At runtime, the web app uses wagmi and viem to read contract state, poll and decode event logs, batch JSON-RPC calls, cache market events locally, and invalidate only the query families affected by new transactions or events.

The AI layer is intentionally separated from settlement. It can summarize snapshots or parse high-level intent, but contract addresses, token IDs, prices, quantities, approvals, and transaction calls are assembled by deterministic application code.

## Tech Stack

- Solidity `0.8.24` and Foundry for contracts, deployment scripts, and tests.
- OpenZeppelin contracts for ERC-1155, ownership, receiver, and security primitives.
- Next.js 16, React 19, TypeScript, and Tailwind CSS for the web app.
- wagmi, viem, Reown AppKit, and TanStack Query for wallet and chain interaction.
- lightweight-charts for market visualization.
- Vitest for front-end unit and component behavior tests.
- DeepSeek-compatible OpenAI client for optional AI insights and intent parsing.

## Local Development

### Prerequisites

- Node.js 20 or newer.
- npm.
- Foundry (`forge`, `cast`, `anvil`).
- An Arc Testnet wallet with native USDC if you want to submit transactions.
- A WalletConnect project ID if you want Reown AppKit wallet connection in the browser.

### Web App

```bash
cd web
npm ci
npm run dev
```

Create `web/.env.local` with the public client-side deployment values:

```text
NEXT_PUBLIC_ARC_CHAIN_ID=5042002
NEXT_PUBLIC_ARC_RPC_URL=https://rpc.testnet.arc.network
NEXT_PUBLIC_ARC_EXPLORER_URL=https://testnet.arcscan.app
NEXT_PUBLIC_DEPLOY_BLOCK=50024851
NEXT_PUBLIC_HADRON_ASSETS=0xA3d3315Ae24D5047E9fA1736Eb98bebF8fA3fc6F
NEXT_PUBLIC_HADRON_MARKET=0xF5AB3ef3906aA089523Fc63D58d885b60ff58dAc
NEXT_PUBLIC_HADRON_YIELD=0x00579D460210Ee74a6547d0144a5eEAF1C799a87
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
```

Optional server-side AI variables:

```text
DEEPSEEK_API_KEY=your_deepseek_key
DEEPSEEK_MODEL=deepseek-v4-flash
```

Do not put private keys in `web/.env.local`. The web app only needs public deployment values and optional server-side AI credentials.

### Contracts

```bash
cd contracts
forge test
```

If dependencies are missing in a fresh checkout, install OpenZeppelin with Foundry:

```bash
cd contracts
forge install OpenZeppelin/openzeppelin-contracts
```

Deployment and seeding scripts live in `contracts/script/`. The latest seeded testnet environment combines asset issuance, primary offerings, listings, bids, bid fills, yield deposits, and a sample claim.

## Verification

Useful checks before opening a pull request:

```bash
cd contracts && forge test
cd web && npm test
cd web && npm run lint
cd web && npm run build
```

The repository follows an OpenSpec and TDD workflow. Current capabilities are documented under `openspec/specs/`, and implementation plans live under `docs/plans/`.

## Security Model

- Market funds and shares are escrowed by contracts, not by a web server.
- Primary purchases, secondary purchases, bid fills, cancellations, yield deposits, and yield claims use contract-level checks and events.
- Market write functions are designed around checks-effects-interactions and non-reentrancy.
- Fee configuration is bounded, treasury updates are evented, and user escrow cannot be swept by an admin function.
- AI features are read-only or intent-level helpers until the user confirms a deterministic wallet transaction.

This is still testnet software. Do not reuse the contracts for production value without an independent audit and a real regulatory/compliance design.

## Project Workflow

HADRON is developed with:

- OpenSpec for capability specifications.
- TDD for contract, hook, component, and data-flow behavior.
- Verifiable testnet transactions for acceptance evidence.
- Graph-based project navigation through `graphify-out/` when available.

## Contributing

Community contributions are welcome. Good first areas include:

- Improving market data presentation and chart interactions.
- Adding tests around assistant edge cases and wallet transaction states.
- Hardening contract invariants and adversarial scenarios.
- Expanding documentation for deployers and front-end integrators.
- Reviewing accessibility, responsive behavior, and RPC usage.

Before changing behavior, check the relevant spec in `openspec/specs/`. For new capabilities or public API changes, open an OpenSpec proposal first.
