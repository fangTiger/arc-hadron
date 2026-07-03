依赖通过 forge install OpenZeppelin/openzeppelin-contracts 重建。

## 部署与播种

SeedV4 用于全新部署后一次性播种 14 个 0.01 份额资产、一级发行、二级卖单、成交样本与买单深度。先在 `.env` 填写 `DEPLOYER_PRIVATE_KEY`、`TREASURY_ADDRESS`、`HADRON_ASSETS`、`HADRON_MARKET`；如需多买单账户深度，可选填写逗号分隔的 `SEED_BIDDER_PRIVATE_KEYS`，留空时使用部署者单账户。

```bash
forge script script/Deploy.s.sol:Deploy --rpc-url "$ARC_RPC_URL" --broadcast
forge script script/SeedV4.s.sol:SeedV4 --rpc-url "$ARC_RPC_URL"
forge script script/SeedV4.s.sol:SeedV4 --rpc-url "$ARC_RPC_URL" --broadcast
```

SeedV4 结束时会输出 tokenId 起止范围、`FIRST_ACTIVE_TOKEN_ID`、offering/listing/bid 计数与 deployer 地址，供后续 env 同步使用。

V5 会全新部署 `HadronAssets`、`HadronMarket`、`HadronYield`，并在同一次广播中执行 `setYieldHook` 锁定收益钩子。部署完成后，把输出地址写入 `.env` 的 `HADRON_ASSETS`、`HADRON_MARKET`、`HADRON_YIELD`，再执行 SeedV5。

```bash
FOUNDRY_OFFLINE=true forge script script/DeployV5.s.sol:DeployV5 --rpc-url "$ARC_RPC_URL" --broadcast --slow
FOUNDRY_OFFLINE=true forge script script/SeedV5.s.sol:SeedV5 --rpc-url "$ARC_RPC_URL"
FOUNDRY_OFFLINE=true forge script script/SeedV5.s.sol:SeedV5 --rpc-url "$ARC_RPC_URL" --broadcast --slow
```

SeedV5 继承 SeedV4 的资产、发行、卖单、成交样本和买单深度播种，并在买单成交形成非排除流通份额后，对 3 个资产各入金 5 USDC 收益样本，再尝试由外部 bidder 领取 1 笔收益。若 `SEED_BIDDER_PRIVATE_KEYS` 留空，买单账户回退为 deployer；deployer 在 V5 中被排除收益分配，领取样本会跳过并输出说明。
