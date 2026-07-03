# Change: HADRON AI 层 — DeepSeek Asset Insight + Market Brief

## Why

HADRON MVP（M1-M5）已归档，路线图（2026-07-03 用户确认）第一个新方向：给交易所加只读 AI 分析能力，提升资产研究与市场概览体验。复用 arc-lepton 已验证的 DeepSeek 基建，边际成本低。

## What Changes

- 新增能力 `ai-insights`：
  - 资产详情页 **Asset Insight**：单资产 AI 简报（Outlook / Liquidity / Risk flags，英文，含免责尾注）
  - 市场页 **Market Brief**：全市场 AI 日报（Movers / New listings / Notable trades）
  - 按需生成（Generate 按钮）+ localStorage 缓存 + 数据指纹失效提示；SSE 流式渲染
  - 服务端 API 路由持有 DEEPSEEK_API_KEY（永不进前端）；进程内限流（每 IP + 全局，429 不调上游）；无 key 开发态 mock 流降级
- 无破坏性变更：不改任何现有合约/页面行为，纯增量面板与路由
- 明确排除：NL 交易助手（涉及资金操作，最后单独立项）

## Acceptance Criteria

见 design.md「验收标准」9 条（GIVEN-WHEN-THEN，Clarify Gate 产出 + Codex 交叉验证补充的边界条件 6/7/8）。

## Out of Scope

- NL 交易助手 / 任何 AI 触发的链上交易
- 服务端链上数据读取、数据库持久化、多语言 AI 输出
- 共享存储限流（多实例部署前提；本项目当前排除部署，文档化留待部署立项）

## Impact

- Affected specs: 新增 `ai-insights`（ADDED）
- Affected code: 全部新增——`web/lib/llm/deepseek.ts`（自 arc-lepton 移植）、`web/lib/ai/*`（snapshot/fingerprint/prompts/sse/rateLimit/useAiGeneration）、`web/app/api/ai/{insight,brief}/route.ts`、`web/components/ai/*`；详情页与市场页各挂一个面板
- 新依赖：`openai`（OpenAI 兼容 SDK，Claude 预装）；env 新增 `DEEPSEEK_API_KEY/BASE_URL/MODEL`（服务端专属，key 由用户从 arc-lepton 复制）
- 实现约束：Claude 设计/调度/审查，codex exec 实现，TDD 强制，交叉检查后用户验收
