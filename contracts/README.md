依赖通过 forge install OpenZeppelin/openzeppelin-contracts 重建。

## 部署与播种

SeedV4 用于全新部署后一次性播种 14 个 0.01 份额资产、一级发行、二级卖单、成交样本与买单深度。先在 `.env` 填写 `DEPLOYER_PRIVATE_KEY`、`TREASURY_ADDRESS`、`HADRON_ASSETS`、`HADRON_MARKET`；如需多买单账户深度，可选填写逗号分隔的 `SEED_BIDDER_PRIVATE_KEYS`，留空时使用部署者单账户。

```bash
forge script script/Deploy.s.sol:Deploy --rpc-url "$ARC_RPC_URL" --broadcast
forge script script/SeedV4.s.sol:SeedV4 --rpc-url "$ARC_RPC_URL"
forge script script/SeedV4.s.sol:SeedV4 --rpc-url "$ARC_RPC_URL" --broadcast
```

SeedV4 结束时会输出 tokenId 起止范围、`FIRST_ACTIVE_TOKEN_ID`、offering/listing/bid 计数与 deployer 地址，供后续 env 同步使用。
