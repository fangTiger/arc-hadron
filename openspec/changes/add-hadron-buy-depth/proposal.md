# Change: 二级市场买单深度（Bid Orders）

## Why

订单簿目前只有卖侧（SELL ORDERS），买家只能被动吃卖单，无法挂价等待成交，市场缺少双边深度与价格发现能力。路线图（2026-07 决策）AI 层之后的下一项即买单深度。

## What Changes

- **BREAKING（合约重部署）**：HadronMarket 增加 Bid 结构与 `placeBid`（原生 USDC 全额托管 + 合约 bidder ERC165 receiver 门）/ `fillBid`（持有人按买单价卖出，部分成交，卖方承担 0.5% 费）/ `cancelBid`（剩余托管退回）/ `getBid` / `bidsByToken` / `bidCount`；三个新事件均带 indexed tokenId/bidder。测试网合约地址更换，演示数据由 SeedV4 重建
- 部署与播种：`Deploy.s.sol` 重部署 + 新 `SeedV4.s.sol`（合并 SeedV3/SeedSecondary/SeedTrades 职责 + 双边深度 + BidFilled 成交样本）+ env 同步（合约地址 / NEXT_PUBLIC_DEPLOY_BLOCK / FIRST_ACTIVE_TOKEN_ID 复核）
- 前端事件层：`bid-placed`/`bid-filled`/`bid-cancelled` 三类型解码；`bid-filled` 计入成交的过滤集合在 events.ts / marketMetrics.ts / ai/snapshot.ts 三处一次性同步（AI 快照零 schema 变更）
- 前端交易：`usePlaceBid`/`useCancelBid`/`useFillBid`（两步授权复用 useListForSale 模式）/`useBids`/`useMyBids` hooks + `lib/bids.ts` 映射
- UI：资产页 BUY ORDERS 表（BidsTable，价格降序 + Fill）与 PlaceBidPanel；持仓页 My Bids 管理与 "Sell to bid" 入口；活动流新事件文案（英文）

## Impact

- Affected specs: `secondary-market`（ADDED 4 需求 + MODIFIED 对抗性安全约束）
- Affected code: `contracts/src/HadronMarket.sol`、`contracts/test/*`、`contracts/script/`（SeedV4）、`contracts/deployments/arc-testnet.json`、`web/lib/{events,marketMetrics,bids,contracts,chain}.ts`、`web/lib/ai/snapshot.ts`（TRADE_TYPES 一行）、`web/lib/hooks/*`（5 个新 hook）、`web/components/market|asset|portfolio/*`、`web/app/asset/[id]/page.tsx`、`web/app/portfolio/*`、web env 文件
- 规模：大任务（合约 + 部署 + 前端 >10 文件），tasks.md 为高层清单，审批后经 writing-plans 细化为 bite-sized 步骤

## Acceptance Criteria（Clarify Gate 产出，详见 design.md）

1. **GIVEN** 已连接钱包与足额 USDC **WHEN** 挂买单 **THEN** 全额托管、BUY ORDERS 即时可见、My Bids 出现
2. **GIVEN** 持有份额且已授权 **WHEN** 对买单 Fill 部分数量 **THEN** 份额转 bidder、卖家收款 99.5%、买单余量准确递减、活动流出现 Bid fill
3. **GIVEN** 自己的活跃买单 **WHEN** 撤单 **THEN** 剩余托管全额退回、订单簿移除
4. **GIVEN** 无 ERC1155 receiver 的合约地址 **WHEN** placeBid **THEN** revert（假深度被阻止）
5. 全部对抗性场景（重入/拒收退款/越权/零值/超量/费取整边界）revert 且状态一致；escrow invariant 测试通过
6. 合约 forge test 全绿 + 前端全量测试/lint/build 通过 + 三页 200；bid-filled 在价格序列、24H 指标、AI 快照三处口径一致

## Out of Scope

- 自动撮合引擎；订单过期语义；AI 快照 bidBook 深度结构（schema 升版单独跟进）；pull 式份额领取；收益分配（下一里程碑）

## 待用户审批的决策点

1. 重部署接受：合约地址更换，旧链上状态不再显示（SeedV4 重建演示数据）
2. 费向：fillBid 沿用卖方承担 0.5%（与现有 buy 一致）
3. BUY ORDERS 布局：SELL ORDERS 下方独立表格（当前设计），左右双边订单簿留作后续迭代
