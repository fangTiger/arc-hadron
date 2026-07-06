# Tasks: 助手 / 命令菜单 + 首页 Brief 压缩 + 文案修正

> TDD 强制（RED-GREEN-REFACTOR）。web 测试：`cd web && npm test`；lint：`npm run lint`；build：`npm run build`。
> 纯前端，复用现有意图/生成管线，零数据/合约改动。保持现有 319 测试无回归。

## 1. 命令注册表与筛选（纯逻辑，先行）

- [ ] 1.1 RED：`web/test/assistant-commands.test.ts` — filterCommands：`/` 返回全部 8 命令、`/se` 过滤到 sell、大小写不敏感、无匹配返回空；每命令 template 映射正确（buy→`buy <qty> <asset>` 等）
- [ ] 1.2 GREEN：`web/lib/assistant/commands.ts` — `commandRegistry`（8 条：command/label/hint/template）+ `filterCommands(input)` 纯函数
- [ ] 1.3 验证：`cd web && npm test -- assistant-commands`

## 2. CommandMenu 子组件

- [ ] 2.1 RED：`web/test/assistant-command-menu.test.tsx` — 渲染筛选后的命令列表、高亮项、点击触发 onSelect(template)
- [ ] 2.2 GREEN：`web/components/assistant/CommandMenu.tsx` — 受控菜单（items + highlightedIndex + onSelect）
- [ ] 2.3 验证：`cd web && npm test -- assistant-command-menu`

## 3. 输入框接线（AssistantPanel）

- [ ] 3.1 RED：`web/test/assistant-panel.test.tsx` 增补 — 输入 `/` 弹菜单；`/se` 过滤 sell；↑↓ 移动高亮；Enter 回填模板并关闭菜单、焦点留输入框；Esc 关闭；非 `/` 输入不弹菜单且 NL 提交不变
- [ ] 3.2 GREEN：`web/components/assistant/AssistantPanel.tsx` — 输入框检测前导 `/` → filterCommands → 挂 CommandMenu → 键盘导航（↑↓/Enter/Esc）→ 选中回填模板
- [ ] 3.3 验证：`cd web && npm test -- assistant-panel`

## 4. 文案修正

- [ ] 4.1 头部提示改为 "Type / for commands, or ask in plain English."
- [ ] 4.2 unknown 兜底话术补齐 sell/cancel/claim（如 "…prices, depth, holdings, yield, buying, selling, cancelling orders, and claiming yield."）
- [ ] 4.3 RED/GREEN：在 assistant-panel 测试断言更新后的文案

## 5. 首页 MarketBrief 压缩

- [ ] 5.1 RED：`web/test/ai-panel-compact.test.tsx` — AiPanelView 传 `compact` 时 markdown 包在限高滚动容器（max-h + overflow-y-auto）；不传时无该容器
- [ ] 5.2 GREEN：`web/components/ai/InsightPanel.tsx` 的 `AiPanelView` 加可选 `compact` prop；`web/components/ai/MarketBrief.tsx` 传 `compact`（InsightPanel 不传）
- [ ] 5.3 验证：`cd web && npm test -- ai-panel-compact`

## 6. 终审验证

- [ ] 6.1 全量测试：`cd web && npm test`（现有 319 + 新增全绿，无回归）
- [ ] 6.2 lint：`cd web && npm run lint`（干净）
- [ ] 6.3 build：`cd web && npm run build`（通过；若沙箱字体网络失败，仅说明不做 workaround）
- [ ] 6.4 逐条核对 design.md AC1-AC6，取证记录
