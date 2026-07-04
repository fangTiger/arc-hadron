# Change: NL 交易助手 v2 — 写动作扩展（sell / cancel / claim）

## Why

NL 助手 v1（`ai-trading-assistant`）交付了读查询 + 买入。v2 在其上补齐用户侧写动作——
挂卖、撤单、领取收益——让助手覆盖完整的用户交易生命周期。复用 v1 意图框架与现有 hook，
边际成本低，纯前端，零合约改动。

## What Changes

- ADDED `ai-trading-assistant` 三条写动作需求：
  - **sell**：`sell N <asset> at P` → 校验持仓与价格（缺价追问）→ SellConfirmCard（两步授权）→ `useListForSale`
  - **cancel**：`cancel my <asset> order` → 拉出该地址该资产全部活跃挂卖 + 买单 → 消歧卡选一 → `cancel`/`cancelBid`
  - **claim**：`claim my <asset> yield` 单资产 `claimYield`；`claim my yield` 无资产 → 批量 `claimYieldBatch`
  - 意图 schema 新增 sell/cancel/claim（deposit/transfer 仍降级 unknown）；同步 intentPrompt + mock
- 延续 v1 铁律：LLM 只产出规范化意图 JSON，绝不产出 id/金额/tx 参数；确定性确认卡；钱包+网络守卫
- 无破坏性：复用现有写 hook 与 tx 状态流，零合约改动

## Acceptance Criteria

见 design.md「验收标准」AC1-AC7（对应 `docs/plans/2026-07-04-nl-assistant-v2-write-actions-design.md` §9）。

## Out of Scope

- deposit yield、transfer、跨档扫单、NL 多轮对话记忆、LLM 措辞回答、任何合约改动

## Impact

- Affected specs: ADDED `ai-trading-assistant`（sell / cancel / claim 三需求）
- Affected code: 扩展 `web/lib/ai/{intent,intentPrompt}.ts`、`web/lib/llm/deepseek.ts` mock；
  新增 `resolveCancelableOrders` / `resolveClaimable` 纯函数、`SellConfirmCard` / `CancelDisambiguationCard` /
  `ClaimConfirmCard` 组件；助手面板分派器新增分支；复用 useListForSale/useCancelListing/useCancelBid/useClaimYield/usePendingYield
