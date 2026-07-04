# Design: NL 交易助手 v2 — 写动作扩展

> 完整设计见 `docs/plans/2026-07-04-nl-assistant-v2-write-actions-design.md`。本文件为 OpenSpec 归档留存摘要。

## 本质
在 v1（读查询 + 买入）之上新增 sell / cancel / claim 三类用户侧写动作。纯前端，复用现有 hook
（useListForSale / useCancelListing / useCancelBid / useClaimYield / usePendingYield / useListings / useBids）
与 v1 意图 / 确认卡 / 交易流框架，零合约改动。不含 deposit yield。

## 铁律（延续 v1）
LLM 只产出规范化意图 JSON（kind/asset/quantity/price），绝不产出 listingId/bidId/tokenId/金额等 tx 参数。
App 确定性解析真实订单/可领/持仓，渲染确定性确认卡，钱包签名。sell 的 price 是用户输入，卡上二次确认后签。

## 意图 Schema 扩展
```ts
| { kind: "sell";   asset: string; quantity: number; price?: number }
| { kind: "cancel"; asset: string }
| { kind: "claim";  asset?: string }
```
v1 中被降级为 unknown 的 sell/cancel/claim 变为真实意图；deposit/transfer 仍降级 unknown。

## 动作流决策
- **sell**：校验 N ≤ 持仓；price 缺失 → 追问 "At what price per share?"；SellConfirmCard 展示两步授权。
- **cancel**：resolveCancelableOrders 拉全部活跃挂卖 + 买单 → 消歧卡选一 → cancel/cancelBid；无可撤则提示。
- **claim**：单资产 claimYield；无资产 → resolveClaimable 汇总所有 pendingYield>0 → claimYieldBatch；无可领则提示。

## 验收标准
- **AC1**：sell 校验持仓/价格（缺价追问），确认卡两步授权，走 useListForSale。
- **AC2**：cancel 消歧卡列全部可撤单，选一 → 对应 cancel/cancelBid 一笔 tx；无可撤时提示。
- **AC3**：claim 单资产 claimYield / 无资产 claimYieldBatch 汇总；金额取自链上；无可领时提示。
- **AC4**：schema 新增 sell/cancel/claim，deposit/transfer 仍降级 unknown。
- **AC5**：延续 v1 安全（限流/byte/形状/严格降级/钱包+网络守卫）；LLM 不碰 id/金额/tx 参数。
- **AC6**：复用现有 tx 状态流，拒签/余额/revert 有英文提示，状态可从链上重建。
- **AC7**：TDD 全绿，web 现有 295 测试无回归。
