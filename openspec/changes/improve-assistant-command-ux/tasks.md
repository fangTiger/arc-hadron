# Tasks: 助手 / 命令菜单 + 首页 Brief 压缩 + 文案修正

> TDD 强制（RED-GREEN-REFACTOR）。web 测试：`cd web && npm test`；lint：`npm run lint`；build：`npm run build`。
> 纯前端，复用现有意图/生成管线，零数据/合约改动。保持现有 319 测试无回归。

## 1. 命令注册表与筛选（纯逻辑，先行）

- [x] 1.1 RED：`web/test/assistant-commands.test.ts` — filterCommands：`/` 返回全部 8 命令、`/se` 过滤到 sell、大小写不敏感、无匹配返回空；每命令 template 映射正确（buy→`buy <qty> <asset>` 等）
- [x] 1.2 GREEN：`web/lib/assistant/commands.ts` — `commandRegistry`（8 条：command/label/hint/template）+ `filterCommands(input)` 纯函数
- [x] 1.3 验证：`cd web && npm test -- assistant-commands`

## 2. CommandMenu 子组件

- [x] 2.1 RED：`web/test/assistant-command-menu.test.tsx` — 渲染筛选后的命令列表、高亮项、点击触发 onSelect(template)
- [x] 2.2 GREEN：`web/components/assistant/CommandMenu.tsx` — 受控菜单（items + highlightedIndex + onSelect）
- [x] 2.3 验证：`cd web && npm test -- assistant-command-menu`

## 3. 输入框接线（AssistantPanel）

- [x] 3.1 RED：`web/test/assistant-panel.test.tsx` 增补 — 输入 `/` 弹菜单；`/se` 过滤 sell；↑↓ 移动高亮；Enter 回填模板并关闭菜单、焦点留输入框；Esc 关闭；非 `/` 输入不弹菜单且 NL 提交不变
- [x] 3.2 GREEN：`web/components/assistant/AssistantPanel.tsx` — 输入框检测前导 `/` → filterCommands → 挂 CommandMenu → 键盘导航（↑↓/Enter/Esc）→ 选中回填模板
- [x] 3.3 验证：`cd web && npm test -- assistant-panel`

## 4. 文案修正

- [x] 4.1 头部提示改为 "Type / for commands, or ask in plain English."
- [x] 4.2 unknown 兜底话术补齐 sell/cancel/claim（如 "…prices, depth, holdings, yield, buying, selling, cancelling orders, and claiming yield."）
- [x] 4.3 RED/GREEN：在 assistant-panel 测试断言更新后的文案

## 5. 首页 MarketBrief 压缩

- [x] 5.1 RED：`web/test/ai-panel-compact.test.tsx` — AiPanelView 传 `compact` 时 markdown 包在限高滚动容器（max-h + overflow-y-auto）；不传时无该容器
- [x] 5.2 GREEN：`web/components/ai/InsightPanel.tsx` 的 `AiPanelView` 加可选 `compact` prop；`web/components/ai/MarketBrief.tsx` 传 `compact`（InsightPanel 不传）
- [x] 5.3 验证：`cd web && npm test -- ai-panel-compact`

## 6. 终审验证

- [x] 6.1 全量测试：`cd web && npm test`（现有 319 + 新增全绿，无回归）
- [x] 6.2 lint：`cd web && npm run lint`（干净）
- [x] 6.3 build：`cd web && npm run build`（沙箱无法连接 Google Fonts，未做 workaround）
- [x] 6.4 逐条核对 design.md AC1-AC6，取证记录

## AC 取证记录

- AC1：`assistant-commands` 与 `assistant-panel` 覆盖 `/` 返回 8 命令、`/se` 过滤到 `/sell`。
- AC2：`assistant-panel` 覆盖 ↑/↓ clamp、高亮移动、Enter 回填模板并关闭菜单、焦点回到输入框；`assistant-command-menu` 覆盖点击回填。
- AC3：`assistant-panel` 覆盖非 `/` 输入不显示菜单，form submit 仍调用原 `onSubmit`。
- AC4：`ai-panel-compact` 覆盖 `AiPanelView compact` 限高滚动 + 底部渐隐、`MarketBriefView` compact、`InsightPanelView` 不 compact。
- AC5：`assistant-panel` 覆盖头部提示与 unknown 兜底话术更新，包含 sell/cancel/claim。
- AC6：未改 contracts、intent schema、AI 生成/SSE 管线或禁改构建/字体配置；`cd web && npm test` 332 通过，`cd web && npm run lint` 通过；build 因沙箱无法连接 Google Fonts 失败，未做 workaround。
