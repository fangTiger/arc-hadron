# Change: 助手 `/` 命令菜单 + 首页 Brief 压缩 + 文案修正

## Why

用户实际使用 NL 助手 v2 后反馈三点 UX 问题：① 输入方式不够优雅、希望 `/` 命令唤起；
② 首页右侧 MarketBrief 在窄列里过长、布局失衡；③ 助手引导文案仍是 v1 老话术（未含 sell/cancel/claim）。
纯前端打磨，复用现有意图管线（命令只是把文本填入同一输入框），零数据/合约改动。

## What Changes

- ADDED `ai-trading-assistant`「命令菜单与输入引导」：输入 `/` 弹可筛选命令菜单（8 命令：price/depth/
  holdings/yield/buy/sell/cancel/claim），↑↓ + Enter/点击回填模板，Esc 关闭；NL 输入照常；
  头部提示与 unknown 兜底话术更新为准确覆盖全部动作
- ADDED `ai-insights`「市场日报首页紧凑呈现」：首页 MarketBrief 限高 + 内部滚动，资产页洞察布局不变
- 无破坏性：复用同一 `/api/ai/intent` 管线与生成管线，零数据/合约改动

## Acceptance Criteria

见 design.md「验收标准」AC1-AC6（对应 `docs/plans/2026-07-06-assistant-command-ux-design.md` §7）。

## Out of Scope

- Cmd+K 全局命令栏、命令小表单（结构化录入）、AI 管线 / 意图 schema / 合约改动、资产页洞察布局改动

## Impact

- Affected specs: ADDED `ai-trading-assistant`（命令菜单）、ADDED `ai-insights`（首页紧凑呈现）
- Affected code: 新增 `web/lib/assistant/commands.ts`、`web/components/assistant/CommandMenu.tsx`；
  改 `AssistantPanel.tsx`（输入接线 + 文案）、`AiPanelView`（compact prop）、`MarketBrief.tsx`（传 compact）
