# HADRON 买单深度设计 — 二级市场 Bid Orders

> 状态：Codex 交叉验证意见（3 阻塞 + 4 建议）已全部吸收（修订记录见文末），**待用户审批**。
> 路线依据：memory/roadmap-decision-2026-07（AI 层 → **买单深度** → 收益分配）。

## Context

HadronMarket 目前只有卖侧：一级 Offering + 二级 Listing（份额托管、原生 USDC 付款、0.5% 费入金库）。订单簿只有 SELL ORDERS 一侧，买家只能吃卖单，无法挂价等待。本期给二级市场加买单（bid）侧，形成双边深度。

## Goals / Non-Goals

**Goals**
- 合约：买家按 `pricePerShare × amount` 托管原生 USDC 挂买单；持有人可按买单价卖出份额（部分/全部成交）；买家可撤单退回剩余托管
- 资产页订单簿双边化：SELL ORDERS 下方/并列增加 BUY ORDERS（价格降序）
- 持仓页：My Bids 管理（撤单）；持有人对买单的"卖出成交"入口
- 事件层：BidPlaced / BidFilled / BidCancelled 进 activity feed 与价格序列（成交价点位）

**Non-Goals**
- 撮合引擎/自动撮合（买卖单价格交叉不自动成交，maker/taker 手动点选——与现有 Listing 交互对称）
- AI 快照增加 bidBook 深度结构（schema 升版单独跟进）；但 **BidFilled 成交计入现有 recentTrades/价格序列**（见前端设计——否则 AI 简报最新价与页面不一致）
- 收益分配（路线图下一项）
- 订单过期/GTC 之外的时效语义
- pull 式份额领取（假深度的完整解法，但破坏与 Listing 的交互对称，演示级 YAGNI 否决；取 ERC165 门 + 残余风险文档化）

## 方案对比

**方案 A（推荐）：扩展 HadronMarket，全栈重部署**
在现有合约内加 `Bid` 结构 + `placeBid/cancelBid/fillBid/bidsByToken/bidCount`，与 Listing 完全对称。测试网重部署 + 新 Seed 脚本（项目已有 SeedV3 迭代惯例，重播种是既定实践）。
- 优点：单一合约单一费率配置；前端单地址；代码对称易审计
- 缺点：测试网状态重置（可接受：演示数据靠 Seed 重建）

**方案 B：独立 HadronBids 合约旁挂**
不动现有市场，新合约管买单。
- 优点：现有状态保留
- 缺点：市场逻辑碎片化、两套 owner/fee/treasury、前端双地址双事件源，长期成本高。否决。

**方案 C：链下签名订单簿**
演示项目维度严重超编（签名撮合、防重放、部分成交记账）。否决。

## 合约设计（方案 A）

```solidity
struct Bid {
    address bidder;
    uint256 tokenId;
    uint256 pricePerShare;   // 每 unit 价（与 Listing 同口径）
    uint256 remaining;       // 剩余可成交份额数
    bool active;
}
```

- `placeBid(tokenId, amount, pricePerShare) payable nonReentrant`：校验 `amount>0`、`pricePerShare>0`、`msg.value == pricePerShare*amount`（全额托管，Solidity 0.8 checked arithmetic 即溢出边界策略，超限自然 revert）；**合约地址 bidder（`code.length>0`）必须通过 ERC165 `supportsInterface(IERC1155Receiver)` 检查**（防不可成交的假买单深度；残余风险：通过检查后回调变卦仍可制造 fill revert，属已文档化的演示级接受项）；`bidCount+1` 入 mapping；发 `BidPlaced(bidId, indexed tokenId, indexed bidder, pricePerShare, amount)`
- `fillBid(bidId, amount) nonReentrant`：卖家（需已 `setApprovalForAll`）以份额吃买单；校验 active、`0 < amount <= remaining`；`remaining -= amount`，归零置 inactive；份额从卖家转 bidder，托管 USDC 按 `pricePerShare*amount` 结算：卖家得 `×(1-feeBps)`、金库得 fee（与 `buy()` 口径一致：卖方承担费）；发 `BidFilled(bidId, indexed tokenId, seller, indexed bidder, amount, totalPaid, fee)`
- `cancelBid(bidId) nonReentrant`：仅 bidder；剩余托管 `pricePerShare*remaining` 全额退回（拒收退款只伤 bidder 自己，不锁他人资产）；置 inactive；发 `BidCancelled(bidId, indexed tokenId, indexed bidder, returnedAmount)`——**三个 Bid 事件均自带 indexed tokenId 与 bidder**，前端解码不依赖跨日志推断（吸收 Listing `Cancelled` 缺 tokenId 的历史教训）
- `getBid(bidId)` / `bidsByToken(tokenId)` / `bidCount`：与 Listing getter 对称；`bidsByToken` 沿用双次线性扫描（演示级规模上限与 `listingsByToken` 相同，规模化需分页/索引，文档化）
- 费取整：每次 fill 的 fee 向下取整，理论上小额多次拆单可压低累计费——演示级显式接受（与现有 `buy()` 部分成交同性质），不引入最小成交金额
- 安全：nonReentrant + checks-effects-interactions；escrow 不变量（活跃 bid 的 `Σ pricePerShare×remaining` ≤ 合约余额中 bid 维度托管额）进 invariant/fuzz 测试
- 复用现有 error 与 `MAX_FEE_BPS`；新增 `NotBidder`、`InactiveBid`、`BidderNotReceiver`

## 前端设计

| 模块 | 变更 |
|------|------|
| `web/lib/contracts.ts` | 新 ABI 条目（地址走 env，见部署节） |
| `web/lib/events.ts` | 三个新事件解码 → `TradeEvent` 扩展 `bid-placed`/`bid-filled`/`bid-cancelled` 类型 |
| **成交类型三处同步** | `BidFilled` 计入成交的过滤集合在三处重复定义，必须一次性同步：`events.ts` TRADE_TYPES、`marketMetrics.ts`、`lib/ai/snapshot.ts` TRADE_TYPES（type 为字符串字段，AI 快照零 schema 变更）；资产页 `TradeHistoryTable` 的 exhaustive 事件文案 switch 同步补齐英文 label |
| `web/lib/bids.ts`（新） | `BidView` 映射 + 排序（价格降序），对称 `listing.ts` |
| hooks | `usePlaceBid` / `useCancelBid` / `useFillBid` / `useBids(tokenId)` / `useMyBids()`，对称现有 useListings 家族；**`useFillBid` 需两步授权状态机（setApprovalForAll → fill），复用/抽象 `useListForSale` 已验证的模式** |
| 资产页 | `BidsTable`（BUY ORDERS，价格降序、Fill 按钮带数量输入）+ `PlaceBidPanel`（对称 BuyPanel/ListModal 风格） |
| 持仓页 | My Bids 区块（撤单）；持有资产行增 "Sell to bid" 入口（复用 Fill 流程） |
| activity feed | 新事件类型文案（英文） |

- 金额输入沿用 SHARE_SCALE=100 两位小数惯例；价格显示每份显示价
- 链上读取沿用现有 multicall + 轮询惯例；listings/bids 读取的分块与缓存优化如在本期出现性能问题一并处理（memory/perf 反馈）

## 部署与数据

- `Deploy.s.sol` 重部署 assets+market → 更新 `contracts/deployments/arc-testnet.json`；前端地址与部署块走 env：`web/.env.local` 与 `.env.example` 的 `NEXT_PUBLIC_*` 合约地址 + `NEXT_PUBLIC_DEPLOY_BLOCK` 同步；`web/lib/chain.ts` 的 `FIRST_ACTIVE_TOKEN_ID` 硬编码复核；测试 env 中的地址常量同步
- 新 `SeedV4.s.sol`：合并 SeedV3/SeedSecondary/SeedTrades 的职责为单脚本（资产/offering/listing 播种 + 各资产 2-4 档买单 + 成交历史含 BidFilled 样本），旧 Seed 脚本保留不动（历史惯例）
- 用户 dev server 与钱包无需变更（同链）；浏览器 localStorage 事件缓存按 DEPLOY_BLOCK/地址自然失效（复核缓存 key 是否含地址）

## 测试策略（TDD）

- 合约：`HadronMarket.bids.t.sol`（成功/边界/权限/部分成交/撤单退款/费取整）+ adversarial 扩展：ERC1155 receiver 回调重入 fillBid、拒收退款 bidder、无 receiver 合约 placeBid 被 ERC165 门拒绝、通过 ERC165 但回调 revert 的假深度场景（现有 `MaliciousReceiver` 只覆盖 ETH 路径，需新增 ERC1155 恶意 receiver helper）
- 合约 invariant/fuzz：活跃 bid 托管额守恒（`Σ pricePerShare×remaining` 与合约余额关系）
- 前端：三个新事件解码（含跨批次分块扫描）、三处成交过滤一致性、BidView 映射排序、三个交易 hook（mock wagmi 惯例，fillBid 两步授权態）、BidsTable/PlaceBidPanel/MyBids 组件态、页面挂载位置、活动流/AI 快照含 bid-filled
- 全量回归：现有 forge 全绿 + web 197 用例零回归

## 开放问题（待用户确认）

1. **重部署确认**：方案 A 意味着测试网合约地址更换、历史链上状态由 SeedV4 重建演示数据——用户此前钱包里的持仓/挂单会指向旧合约（前端切新地址后不可见）。是否接受？
2. **费向**：fillBid 沿用"卖方承担 0.5%"（与现有 buy 一致）还是买卖双向各承担一半？当前设计取前者（一致性优先）
3. **UI 布局**：BUY ORDERS 放 SELL ORDERS 下方（保守）还是左右并列成经典双边订单簿（信息密度更高但改版更大）？当前设计取下方独立表格，待用户看效果再迭代

## 验收标准（Clarify Gate 初稿，交叉验证后细化）

1. GIVEN 已连接钱包与足额 USDC WHEN 挂买单 THEN 全额托管、BUY ORDERS 即时可见、My Bids 出现
2. GIVEN 持有份额且已授权 WHEN 对买单 Fill 部分数量 THEN 份额转 bidder、卖家收款 99.5%、买单余量准确递减、活动流出现 BidFilled
3. GIVEN 自己的活跃买单 WHEN 撤单 THEN 剩余托管全额退回、订单簿移除
4. 全部对抗性场景（重入/拒收/越权/零值/超量）revert 且状态一致
5. 合约 forge test 全绿 + 前端全量测试/lint/build 通过 + 三页 200

## 修订记录（Codex 交叉验证吸收，2026-07-03）

- [阻塞→已解] 恶意 bidder 假深度：placeBid 对合约地址 bidder 加 ERC165 `IERC1155Receiver` 检查；残余风险（通过检查后回调变卦）文档化为演示级接受；pull 式领取进 Non-Goals（YAGNI）；对应 adversarial 用例进测试策略
- [阻塞→已解] 前端成交过滤三处同步：events.ts / marketMetrics.ts / ai/snapshot.ts 的 TRADE_TYPES 一次性加 bid-filled（AI 快照零 schema 变更，最新价口径一致）；资产页 exhaustive 事件 label 同步；fillBid 两步授权复用 useListForSale 模式
- [阻塞→已解] OpenSpec 流程：本设计经用户审批后创建 secondary-market spec delta + proposal + tasks（大任务，高层 tasks + writing-plans 细化）
- [建议→已解] Bid 三事件均带 indexed tokenId/bidder（吸收 Cancelled 缺 tokenId 教训）；checked arithmetic 溢出策略显式声明；escrow invariant/fuzz 进测试；费取整拆单行为显式接受；部署细节修正（contracts/deployments 路径、env 化地址、NEXT_PUBLIC_DEPLOY_BLOCK、FIRST_ACTIVE_TOKEN_ID、SeedV4 合并三个旧脚本职责）
