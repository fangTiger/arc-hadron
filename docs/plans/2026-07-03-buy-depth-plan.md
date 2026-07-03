# 买单深度实现计划（add-hadron-buy-depth）

> **For agentic workers:** 本项目执行模式为 Claude 调度 codex exec 分组实现（TDD 强制）；本计划的接口签名/事件拓扑/用例清单为承重约定，实现体由 codex 在 RED→GREEN 中编写。步骤用 checkbox 跟踪，进度同步回 openspec/changes/add-hadron-buy-depth/tasks.md。

**Goal:** 二级市场增加买单侧：placeBid 托管 USDC、fillBid 部分成交（卖方承担 0.5% 费）、cancelBid 退款，前端双边订单簿 + My Bids。

**Architecture:** 方案 A——扩展 HadronMarket（与 Listing 家族完全对称）+ arc-testnet 全栈重部署 + SeedV4 播种双边深度；前端沿 events→mappers→hooks→components 既有分层。

**Tech Stack:** Solidity 0.8.24 / OpenZeppelin / Foundry；Next.js 16 + wagmi + vitest。

**用户已决策（2026-07-03）：** 重部署接受；fillBid 沿用卖方承担 0.5% 费；BUY ORDERS 放 SELL ORDERS 下方。

---

## 组 1：合约（codex，forge TDD）

### Task 1.1 Bid 核心（`contracts/src/HadronMarket.sol` + `contracts/test/HadronMarket.bids.t.sol`）

**承重接口（必须按此签名实现）：**

```solidity
struct Bid {
    address bidder;
    uint256 tokenId;
    uint256 pricePerShare;   // 每 unit 价，与 Listing 同口径
    uint256 remaining;       // 剩余可成交份额
    bool active;
}

uint256 public bidCount;

event BidPlaced(uint256 indexed bidId, uint256 indexed tokenId, address indexed bidder, uint256 pricePerShare, uint256 amount);
event BidFilled(uint256 indexed bidId, uint256 indexed tokenId, address indexed bidder, address seller, uint256 amount, uint256 totalPaid, uint256 fee);
event BidCancelled(uint256 indexed bidId, uint256 indexed tokenId, address indexed bidder, uint256 pricePerShare, uint256 amount, uint256 returnedAmount);
// amount = 撤销时剩余份额数；returnedAmount = 退回 USDC（= pricePerShare*amount）；避免前端把 USDC 金额误当份额

error NotBidder();
error InactiveBid();
error BidderNotReceiver();

function placeBid(uint256 tokenId, uint256 amount, uint256 pricePerShare) external payable nonReentrant returns (uint256);
function fillBid(uint256 bidId, uint256 amount) external nonReentrant;
function cancelBid(uint256 bidId) external nonReentrant;
function getBid(uint256 bidId) external view returns (Bid memory);
function bidsByToken(uint256 tokenId) external view returns (uint256[] memory);
```

**实现要点：**
- placeBid：ZeroAmount/ZeroPrice/WrongPayment（`msg.value != pricePerShare*amount`）复用现有 error；`msg.sender.code.length > 0` 时 `try IERC165(msg.sender).supportsInterface(type(IERC1155Receiver).interfaceId)` 必须返回 true，否则（含 try 失败）revert `BidderNotReceiver`
- fillBid：`_requireActiveBid`（InactiveBid）；`0 < amount <= remaining`（ZeroAmount/ExceedsRemaining）；CEI：先记账（remaining 递减、归零置 inactive）再 emit 再交互；份额 `assets.safeTransferFrom(msg.sender, bid.bidder, ...)`（卖家需 setApprovalForAll，未授权由 ERC1155 revert）；`fee = totalPaid*feeBps/10_000`，`_sendValue(msg.sender, totalPaid-fee)`、`_sendValue(treasury, fee)`
- cancelBid：NotBidder/InactiveBid；`returned = pricePerShare*remaining`；置零后 `_sendValue(bid.bidder, returned)`
- getter/`_requireExistingBid`/`_requireActiveBid`/`bidsByToken` 双次线性扫描——全部对称 Listing 家族现有写法
- 注释中文，风格与现有合约一致

**用例清单（先 RED）：** 成功挂单（事件/托管余额）；付款不符 revert；零价/零量 revert；EOA 直接通过 receiver 门；成功部分成交（份额/货款/费/余量断言）；两次部分成交至归零后 active=false；**全量成交后再次 fillBid revert**；未授权 fill revert；零量/超量 fill revert；已撤销 bid fill revert；非 bidder 撤单 revert；部分成交后撤单退款额准确（事件三字段断言）；全量成交后撤单 revert；费向下取整边界（totalPaid=1 wei 级）；getBid 不存在 id revert；bidsByToken 只含活跃有余量项。

**验证：** `cd contracts && forge test --match-path 'test/HadronMarket.bids.t.sol' -vv` 全绿，且 `forge test` 全量零回归。

### Task 1.2 对抗与不变量（`contracts/test/helpers/MaliciousERC1155Receiver.sol` + `contracts/test/HadronMarket.adversarial.t.sol` 扩展）

- 新 helper：可配置模式——正常接收 / onERC1155Received 中 revert / 回调中重入指定市场函数（fillBid/cancelBid/placeBid）；supportsInterface 可配置真假
- 用例：无 receiver 合约 placeBid 被 `BidderNotReceiver` 拒；supportsInterface=true 但回调 revert 的 bid 存在时 fillBid revert 且市场状态一致（假深度残余风险实证）；回调重入 fillBid/cancelBid 被 nonReentrant 拒且余量/托管一致；拒收退款 bidder 的 cancelBid revert 只伤自己（他人挂单/买单不受影响）；**恶意 seller 合约（复用现有 MaliciousReceiver ETH 路径）调用 fillBid 后在 receive 中重入被拒 / 拒收货款则该笔 fill revert 且 bid 状态不变**
- invariant/fuzz（foundry invariant 或有界 fuzz）：随机 place/fill/cancel 序列后，`Σ(active bid 的 pricePerShare×remaining)` ≤ 市场合约原生余额

**验证：** `forge test --match-path 'test/HadronMarket.adversarial.t.sol' -vv` 全绿。

### Task 1.3 合约取证（Claude 亲自）

`cd contracts && forge test` 全量输出留存 → 勾选 tasks.md 1.1-1.3 → 提交 `feat(contracts): 买单深度——Bid 三函数 + 对抗/不变量测试`。

---

## 组 2：前端事件层与数据（codex，web TDD；无需链上，新 ABI 来自组 1 产物）

> 组序决策（吸收 codex 计划审查）：前端先用新 ABI + mock 测试开发，重部署压到组 4 一次完成，避免旧合约上 SeedV4 dry-run 失败与两次部署。

### Task 2.0 ABI 同步

- 先查 `web/lib/contracts.ts` 的 ABI 来源惯例，把组 1 合约新增的三函数/三事件/新 error 追加进 `HADRON_MARKET_ABI`

### Task 2.1 事件解码（`web/lib/events.ts` + `web/test/` 对应测试）

**承重类型扩展：**
```ts
// TradeEvent.type 增加三个字面量
type: "primary-sale" | "purchased" | ...existing | "bid-placed" | "bid-filled" | "bid-cancelled"
// bid-filled 字段映射：buyer=bidder、seller=seller、pricePerShare、amount、totalPaid（与 purchased 对称）
// bid-placed/bid-cancelled：bidder 落 buyer 字段，amount/pricePerShare 保留，totalPaid 无
```
- ABI 追加三事件；解码测试含跨批次分块扫描用例（沿现有 events 测试惯例）

### Task 2.2 成交口径同步（四处）+ label

- `events.ts` 成交过滤、`web/lib/marketMetrics.ts`、`web/lib/ai/snapshot.ts` TRADE_TYPES 同步加 `bid-filled`；**`usePortfolio` 的持仓成本口径同样纳入 `bid-filled`（bidder 即 buyer 的买入）**；一致性测试（四处对同一事件集口径一致）
- 资产页 `TradeHistoryTable` exhaustive switch 补三个英文 label（如 "BID FILL"/"BID"/"BID CANCEL"，风格与现有一致）
- 活动流（`web/components/market/ActivityPanel` 或对应文案层）补英文文案

### Task 2.3 `web/lib/bids.ts` + 读 hooks（`web/lib/hooks/useBids.ts`）

```ts
export interface BidView { id: bigint; bidder: `0x${string}`; tokenId: bigint; pricePerShare: bigint; remaining: bigint; active: boolean; isOwn: boolean; }
// 排序：价格降序、同价 id 升序（对称 listing.ts）
export function useBids(tokenId: bigint | null): { bids: BidView[]; isLoading: boolean }
export function useMyBids(): { bids: BidView[]; isLoading: boolean }
```
- 合约读取沿 useListings 家族 multicall 惯例（bidCount → getBid 批量）

**组 2 验证：** `cd web && npm run test`（零回归）+ lint → 勾选对应 tasks → 提交。

---

## 组 3：交易 hooks 与 UI（codex，web TDD）

### Task 3.1 交易 hooks（`web/lib/hooks/usePlaceBid.ts` / `useCancelBid.ts` / `useFillBid.ts`）

- usePlaceBid/useCancelBid 对称 useBuyListing/useCancelListing（writeContract + 状态机 + 错误映射英文）
- useFillBid 两步授权状态机复用 `useListForSale` 模式（isApproved 读取 → setApprovalForAll → fillBid），状态对外语义一致
- 数量输入 SHARE_SCALE=100 两位小数惯例

### Task 3.2 资产页（`web/components/asset/BidsTable.tsx` + `PlaceBidPanel.tsx` + 挂载 `web/app/asset/[id]/page.tsx`）

- BidsTable：BUY ORDERS 表（SELL ORDERS 下方），列对称 ListingsTable（价格每份显示价、数量、bidder 短地址、own 徽章），行内 Fill 按钮 + 数量输入（默认全量）
- PlaceBidPanel：对称 BuyPanel/ListModal 风格（价格 + 数量输入、托管总额预览、余额校验）
- 挂载顺序：SELL ORDERS（ListingsTable）→ BUY ORDERS（BidsTable）→ TradeHistory

### Task 3.3 持仓页（My Bids 区块 + "Sell to bid" 入口 + 挂载）

- My Bids：表格（资产/价格/余量/托管额/Cancel 按钮），空态英文文案
- 持有资产行增 "Sell to bid" 入口 → 打开该资产 Fill 流程（复用 3.1/3.2 组件）

### Task 3.4 活动流文案（若 2.2 未覆盖处补齐）

**组 3 验证：** 全量 test + lint（UI 文案英文、注释中文）→ 勾选对应 tasks → 提交。

---

## 组 4：部署与播种（codex 写脚本，Claude 执行广播——一次性完成）

### Task 4.1 `contracts/script/SeedV4.s.sol`（codex）

- 合并 SeedV3 + SeedSecondary + SeedTrades 职责为单脚本（先读三者理解播种账户与数据形态），新增：每资产 2-4 档买单（价格低于最优卖价）+ 2-3 笔 BidFilled 成交样本（进价格序列）
- **bidder 执行模型**：可选 env `SEED_BIDDER_PRIVATE_KEYS`（逗号分隔），脚本先由 deployer 向各 bidder 转原生 USDC 资助再各自 placeBid；env 缺省时回退 deployer 单 bidder（own 徽章全亮，演示可接受）；`contracts/.env.example` 同步新变量
- 脚本输出播种 tokenId 起止范围（console.log），供 FIRST_ACTIVE_TOKEN_ID 同步
- 旧 Seed 脚本保留不动；README 部署节同步

### Task 4.2 重部署 + 播种 + env 切换（Claude 亲自，需广播密钥，执行前告知用户）

- `forge script script/Deploy.s.sol --rpc-url $ARC_RPC --broadcast`（构造参数不变，脚本无需结构性修改）→ 新地址写 `contracts/deployments/arc-testnet.json` 与 `contracts/.env`
- SeedV4 先对新地址 dry-run（`--fork-url`）再 `--broadcast`
- web 切换：`web/.env.local` 与 `.env.example` 的 `NEXT_PUBLIC_*` 地址 + `NEXT_PUBLIC_DEPLOY_BLOCK`（新部署块）；**`web/lib/chain.ts` FIRST_ACTIVE_TOKEN_ID 按 SeedV4 输出起点更新（fresh 部署预期为 1n，硬阻断项——不改则新事件全被 filterActiveMarketEvents 过滤）**；`web/test` 中地址/tokenId 常量复核
- 浏览器 localStorage 事件缓存按新 DEPLOY_BLOCK/地址自然失效（复核缓存 key 组成）

### Task 4.3 E2E 验证（Claude）

- dev server 三页 200、市场/资产/持仓数据可见、BUY ORDERS 档位与 BidFilled 成交显示正常 → 勾选对应 tasks → 提交

---

## 组 5：验证 · 交叉检查 · 验收 · 归档

- 5.1 Claude：forge test + web test/lint/build + dev 三页 200 + BUY ORDERS/My Bids 实际可见（取证零回归）
- 5.2 Codex 只读交叉检查（合约资金流/对抗面/三处口径/中文残留/spec 符合性）→ Claude 独立评估修复 → 重验
- 5.3 用户验收：真实钱包挂买单 → Fill 部分成交 → 撤单退款；订单簿/活动流/AI 简报口径观察
- 5.4 归档：delta 合并 `openspec/specs/secondary-market/`、design.md 同步、完整性 6 项检查

---

## 自查记录

- spec 覆盖：delta 4 ADDED + 1 MODIFIED 需求分别落 Task 1.1（托管/成交/撤单）、1.2+MODIFIED（对抗）、组 2/3（可读接口与前端呈现、口径同步）✓
- 类型一致性：BidView/事件字段/hook 签名在组 2 与组 3 间一致 ✓
- 占位符：无 TBD；ABI 来源与播种账户标注了"实现时先读现有文件"，属探索性前置而非缺口 ✓

## 修订记录（Codex 计划审查吸收，2026-07-03）

- [阻塞→已解] BidCancelled 事件补 `pricePerShare/amount/returnedAmount` 三字段（原计划事件字段与 TradeEvent 口径自相矛盾，会把 USDC 误显示为份额）
- [阻塞→已解] 组序重排：合约 → 前端事件层（新 ABI + mock）→ 交易+UI → **一次性部署+SeedV4+env 切换+E2E**（原顺序会在旧合约上 SeedV4 dry-run 失败）
- [阻塞→已解] SeedV4 bidder 执行模型：可选 SEED_BIDDER_PRIVATE_KEYS + deployer 资助，缺省回退单 bidder
- [阻塞→已解] FIRST_ACTIVE_TOKEN_ID 从"复核"升级为硬阻断明确步骤（按 SeedV4 输出起点更新，预期 1n）
- [阻塞→已解] 补对抗用例：恶意 seller 收款重入/拒收、全量成交后再 fillBid revert
- [建议→已解] portfolio 成本口径纳入 bid-filled（第四处口径点）；README 与 contracts/.env.example 同步进组 4
