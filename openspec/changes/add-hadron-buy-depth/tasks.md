# Tasks: 二级市场买单深度（Bid Orders）

> 大任务：本清单为高层任务，**审批后经 `superpowers:writing-plans` 细化为 bite-sized 步骤**再实现。
> 分工：Claude 设计/审查/取证，codex exec 实现（TDD）；合约组与前端组串行，组内先 RED。

## 1. 合约（forge TDD）

- [ ] 1.1 `HadronMarket.sol`：Bid 结构 + `placeBid`（托管 + ERC165 receiver 门）+ `fillBid`（部分成交 + 费结算）+ `cancelBid`（退款）+ `getBid`/`bidsByToken`/`bidCount` + 三事件（indexed tokenId/bidder）+ 新 error；`HadronMarket.bids.t.sol` 全场景（成功/边界/权限/部分成交/退款/费取整）
- [ ] 1.2 对抗测试扩展：ERC1155 恶意 receiver helper（回调重入/回调 revert）+ 拒收退款 bidder + 无 receiver 合约被 ERC165 门拒绝；escrow 守恒 invariant/fuzz
- [ ] 1.3 forge test 全绿取证（Claude 亲自跑）

## 2. 部署与播种

- [ ] 2.1 `SeedV4.s.sol`（合并 SeedV3/SeedSecondary/SeedTrades 职责 + 各资产 2-4 档买单 + BidFilled 成交样本）
- [ ] 2.2 重部署 arc-testnet + 更新 `contracts/deployments/arc-testnet.json` + web env 同步（合约地址 / NEXT_PUBLIC_DEPLOY_BLOCK / FIRST_ACTIVE_TOKEN_ID 复核 / .env.example / 测试 env 常量）
- [ ] 2.3 dev server 验证新地址读取正常（三页 200 + 数据可见）

## 3. 前端事件层与数据（web TDD）

- [ ] 3.1 `events.ts` 三个新事件解码（`bid-placed`/`bid-filled`/`bid-cancelled`，含跨批次分块扫描用例）+ ABI 更新
- [ ] 3.2 成交过滤三处同步：`events.ts` / `marketMetrics.ts` / `lib/ai/snapshot.ts` 的 TRADE_TYPES 加 `bid-filled`；资产页 TradeHistoryTable exhaustive label 补齐；一致性测试
- [ ] 3.3 `lib/bids.ts`（BidView 映射 + 价格降序）+ `useBids(tokenId)`/`useMyBids()` 读 hooks

## 4. 前端交易与 UI（web TDD）

- [ ] 4.1 `usePlaceBid`/`useCancelBid` 交易 hooks；`useFillBid` 两步授权状态机（复用 useListForSale 模式）
- [ ] 4.2 资产页：`BidsTable`（BUY ORDERS，SELL ORDERS 下方，Fill 带数量输入）+ `PlaceBidPanel`（对称 BuyPanel/ListModal 风格）+ 挂载
- [ ] 4.3 持仓页：My Bids 区块（撤单）+ 持有行 "Sell to bid" 入口 + 挂载
- [ ] 4.4 活动流新事件文案（英文）

## 5. 验证 · 交叉检查 · 验收 · 归档

- [ ] 5.1 Claude：forge test + web 全量 test/lint/build + dev 三页 200 取证（零回归）
- [ ] 5.2 Codex 只读交叉检查（合约资金流/对抗面/三处口径一致性/中文残留/spec 符合性）；阻塞项修复后重验
- [ ] 5.3 用户验收：真实钱包挂买单 → 另一账户 Fill 部分成交 → 撤单退款；观察订单簿/活动流/AI 简报口径
- [ ] 5.4 归档：delta 合并 `openspec/specs/secondary-market/`、design.md 同步、完整性 6 项检查
