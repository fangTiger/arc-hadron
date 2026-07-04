# NL 交易助手 v2 — 写动作扩展（sell / cancel / claim）

> 日期：2026-07-04
> 状态：设计已确认，待 OpenSpec 提案
> 类型：中任务（纯前端，复用 v1 框架）
> 分工：Claude 设计/审查/取证，codex exec 实现（TDD）

## 1. 背景与目标

NL 助手 v1（`ai-trading-assistant`，已归档）交付了读查询 + 买入。v2 在其上新增三类
**用户侧写动作**：挂卖（list）、撤单（撤挂卖 / 撤买单）、领取收益（claim）。
**不含 deposit yield**（发行方 / owner 注资，非普通交易，排除）。

纯前端，复用现有 hook（`useListForSale` / `useCancelListing` / `useCancelBid` / `useClaimYield` /
`usePendingYield` / `useListings` / `useBids`）与 v1 的意图 / 确认卡 / 交易流框架，**零合约改动**。

## 2. 铁律（延续 v1）

LLM 只产出**规范化意图 JSON**（kind / asset / quantity / price），绝不产出 listingId / bidId /
tokenId / 金额等最终 tx 参数。App 确定性解析用户真实订单 / 可领收益 / 持仓，渲染确定性确认卡，
钱包签名。sell 的 price 为用户输入（非 LLM 臆造），确认卡二次确认后才签。

## 3. 意图 Schema 扩展

```ts
| { kind: "sell";   asset: string; quantity: number; price?: number }  // 挂卖
| { kind: "cancel"; asset: string }                                    // → 消歧卡选一条
| { kind: "claim";  asset?: string }                                   // 单资产 or 全部批量
```

- v1 里 sell / cancel / claim 被降级为 `unknown`；v2 将其变为真实意图（deposit / transfer 仍 `unknown`）。
- 同步更新 `intentPrompt.ts`（few-shot 覆盖新动作）与 `deepseek.ts` mock 解析器（关键词 → canned intent）。
- 校验：sell 的 quantity>0 且两位小数、price（若有）>0 且两位小数；cancel 需 asset；claim 的 asset 可选。

## 4. 三个动作流

### 4.1 sell（挂卖，两步授权）
- `sell N <asset> at P` → 解析 asset → tokenId；校验 `N ≤ 我的持仓`；price 校验。
- **price 缺失** → 澄清追问 "At what price per share?"，不猜测。
- 确认卡（SellConfirmCard）：资产 / 数量 / 单价 / 预计所得 / **两步状态（setApprovalForAll → list）**；
  复用 `useListForSale`（已封装授权两步 + tx 状态流）。
- 持仓不足 → 卡片提示，不发交易。

### 4.2 cancel（消歧卡选一条）
- `cancel my <asset> order` → `resolveCancelableOrders(tokenId, address)` 拉出该地址在此资产的
  **所有活跃挂卖 + 买单**（侧 / 价 / 量 / id）。
- 消歧卡（CancelDisambiguationCard）列出可撤订单，点选一条 → 确认 →
  `cancel(listingId)`（退托管份额）或 `cancelBid(bidId)`（退托管 USDC）。
- 无可撤订单 → 提示 "No open orders to cancel for <asset>"，不发交易。
- 需钱包连接；未连接 → 提示连接。

### 4.3 claim（单 / 批量）
- `claim my <asset> yield` → 单资产 `claimYield(tokenId)`。
- `claim my yield`（无资产）→ `resolveClaimable(address)` 汇总所有 `pendingYield>0` 的 tokenId →
  `claimYieldBatch(tokenIds)`。
- 确认卡（ClaimConfirmCard）确定性展示可领金额（来自链上 `pendingYield`）；
  无可领 → 提示 "Nothing to claim"。

## 5. 安全

延续 v1：`DEEPSEEK_API_KEY` 仅服务端；意图路由限流 / byte 上限 / 形状校验；LLM 输出严格 schema 降级；
签名前钱包 + Arc testnet 网络守卫。所有金额 / id / 持仓 / 可领校验均在链上数据上确定性完成，LLM 不碰。

## 6. 组件与数据流

- 扩展 `web/lib/ai/intent.ts`（新 kind + 校验）、`intentPrompt.ts`、`web/lib/llm/deepseek.ts` mock。
- 新增确定性纯函数：`resolveCancelableOrders(tokenId, address, { listings, bids })`、
  `resolveClaimable(address, { pending })`、sell 的持仓校验（可单测）。
- 新增确认卡组件：`SellConfirmCard`、`CancelDisambiguationCard`、`ClaimConfirmCard`（复用现有 hook 与 tx 状态流）。
- 助手面板分派器新增 sell / cancel / claim 分支。

## 7. 测试策略（TDD）

- 纯函数单测：resolveCancelableOrders（多单列举 / 仅一侧 / 空 / 按地址过滤）、resolveClaimable
  （批量汇总 / 单资产 / 无可领）、sell 持仓校验（足 / 不足 / 小数）。
- 意图 schema 单测：sell/cancel/claim 白名单通过、price 可选、deposit/transfer 仍降级 unknown。
- 组件测试：SellConfirmCard 两步授权与持仓守卫、CancelDisambiguationCard 列表选一触发对应 cancel、
  ClaimConfirmCard 单 / 批量与无可领降级、未连钱包守卫、拒签。
- web 现有 295 测试无回归。

## 8. 不在范围（Out of Scope）

- deposit yield、transfer、跨档扫单、NL 多轮对话记忆、LLM 措辞回答、任何合约改动。

## 9. 验收标准（Acceptance Criteria）

- **AC1**：sell 组装挂卖，price 缺失时追问、持仓不足时拦截；确认卡展示两步授权，签名走 useListForSale。
- **AC2**：cancel 拉出该地址该资产全部活跃挂卖 + 买单于消歧卡，选一条 → 对应 cancel/cancelBid 一笔 tx；无可撤时提示。
- **AC3**：claim 单资产走 claimYield、无资产走 claimYieldBatch 汇总全部可领；金额取自链上；无可领时提示。
- **AC4**：意图 schema 新增 sell/cancel/claim 白名单，deposit/transfer 仍降级 unknown。
- **AC5**：延续 v1 安全（限流 / byte / 形状 / 严格降级 / 钱包 + 网络守卫）；LLM 不碰 id/金额/tx 参数。
- **AC6**：所有写动作复用现有 tx 状态流，拒签 / 余额 / revert 有英文提示，状态可从链上重建。
- **AC7**：TDD 全绿，web 现有 295 测试无回归。
