# Change: NL 交易助手 v1 — 结构化意图通道（读查询 + 买入）

## Why

AI 层（`add-hadron-ai-layer`，2026-07-03 归档）显式预留了"NL 交易助手"作为最后单独立项。
现有 AI 层是**流式散文洞察**通道；本变更新增一条正交的**结构化意图**通道：
自然语言 → LLM 意图解析 → App 确定性执行（读查询渲染卡片 / 买入组装交易 → 钱包签名），
把交易所的研究与下单体验统一进一个全局助手，且严格隔离 LLM 于签名与展示数字之外。

## What Changes

- 新增能力 `ai-trading-assistant`：
  - 全局浮动聊天面板；资产页打开时默认带入当前资产上下文
  - **读查询**：价格（一级/最低卖/最高买）、盘口深度、我的持仓、我的未领收益 → 确定性卡片
  - **写动作**：买入（一级发行或单条二级卖单，单一最优来源满额成交）→ 确定性确认卡 → 钱包签名
  - LLM（DeepSeek JSON mode）**只产出规范化意图 JSON**，绝不产出数字/地址/tx 参数；
    非白名单意图降级 `unknown`；asset 由 App 对 registry 确定性匹配（歧义/未命中给澄清卡）
  - 复用 ai-insights 安全基建：服务端持 key、进程内限流、byte 上限、形状校验、无 key mock 降级
- 无破坏性变更：零合约改动，读用现有 getter，买用现有 `buyPrimary`/`buy`，复用现有 tx 状态流
- 明确排除：挂卖/撤单/入金/领取、跨档扫单、NL 多轮记忆、LLM 措辞回答

## Acceptance Criteria

见 design.md「验收标准」AC1-AC7（对应设计文档 `docs/plans/2026-07-04-nl-trading-assistant-design.md` §12）。

## Out of Scope

- 写动作：挂卖（list）/ 撤单（cancel）/ 入金（deposit yield）/ 领取（claim）
- 跨档扫单（多 tx 凑单）、NL 多轮对话记忆/上下文指代
- LLM 措辞的自然语言回答（数字一律确定性卡片）
- 语音输入、订单簿 v2 视觉升级、任何合约改动、共享存储限流（部署前提）

## Impact

- Affected specs: 新增 `ai-trading-assistant`（ADDED）
- Affected code: 新增 `web/app/api/ai/intent/route.ts`、`web/lib/ai/{intent,intentPrompt,resolveBuy}.ts`、
  `web/components/assistant/*`；扩展 `web/lib/llm/deepseek.ts`（意图 mock）、从 `routeShared.ts` 提取共享校验；
  复用钱包/交易 hook 与 tx 状态流
