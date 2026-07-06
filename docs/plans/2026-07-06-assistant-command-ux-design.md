# 助手命令 UX + 首页 Brief 压缩 + 文案修正 — 设计文档

> 日期：2026-07-06
> 状态：设计已确认，待 OpenSpec 提案
> 类型：中任务（纯前端 UX 打磨）
> 来源：用户实际使用 NL 助手后的三条反馈
> 分工：Claude 设计/审查/取证，codex exec 实现（TDD）

## 1. 背景

用户体验 NL 助手 v2 后反馈三点：
1. 点开助手后输入方式不够优雅（输入框大写 mono 样式易被当成 label，只显眼 Send 按钮），希望新增 `/` 命令唤起。
2. 首页右侧 MarketBrief（AI 日报）在 280px 窄列里整段 markdown 铺开、过长，布局失衡。
3. 助手头部提示与 unknown 兜底话术仍是 v1 老文案（只提 buying），未含 sell/cancel/claim。

纯前端，复用现有意图管线（命令只是把文本填入同一输入框 → 同一 `/api/ai/intent`），零数据/合约改动。

## 2. ① 助手 `/` 命令菜单

- `AssistantPanelView` 输入框以 `/` 开头时，上方弹出**可筛选命令菜单**；`/` 后继续打字过滤（如 `/se` → `/sell`）。
- 命令注册表（8 条，各带说明 + 填入模板）：

  | 命令 | 说明 | 填入模板 |
  |---|---|---|
  | `/price` | lowest ask / best bid | `price <asset>` |
  | `/depth` | order book depth | `depth <asset>` |
  | `/holdings` | your position | `my <asset> holdings` |
  | `/yield` | unclaimed yield | `my yield` |
  | `/buy` | buy shares | `buy <qty> <asset>` |
  | `/sell` | list shares for sale | `sell <qty> <asset> at <price>` |
  | `/cancel` | cancel an open order | `cancel my <asset> order` |
  | `/claim` | claim yield | `claim my yield` |

- **↑↓ 选择 + Enter/点击 → 把模板填入输入框**（含 `<asset>` 等占位，用户补参数），菜单关闭、焦点留在输入框；**Esc 关闭菜单**。
- **自然语言输入照常可用**：不以 `/` 开头即原 NL 行为，走同一提交管线。
- 命令菜单即能力发现入口。

**组件划分**
- `web/lib/assistant/commands.ts`：`commandRegistry`（纯数据）+ `filterCommands(query)`（纯函数）。
- `web/components/assistant/CommandMenu.tsx`：受控菜单（列表 + 高亮项 + 点击/键盘选择）。
- `AssistantPanelView` 输入框接线：检测前导 `/` → 过滤 → 键盘导航（↑↓/Enter/Esc）→ 选中回填模板。

## 3. ② 首页 MarketBrief 压缩（只改首页窄列）

- `AiPanelView` 新增可选 prop `compact?: boolean`（或 `bodyMaxHeightClassName`）：命中时把 markdown 包进
  `max-h-[16rem] overflow-y-auto` 容器 + 底部渐隐。
- **仅 MarketBrief（首页 280px 列）传该 prop**；资产页 `InsightPanel`（宽列）不传 → 行为完全不变。
- 效果：列高固定不撞布局，内容仍完整可滚。

## 4. ③ 文案修正

- 助手头部提示（`AssistantPanel.tsx` 约 line 303）："Ask about prices, depth, holdings, yield, or buying." →
  **"Type / for commands, or ask in plain English."**
- `unknown` 兜底话术（约 line 208）补齐全部动作，如：
  "I can help with prices, depth, holdings, yield, buying, selling, cancelling orders, and claiming yield."

## 5. 测试策略（TDD）

- 纯函数：`filterCommands`（前缀过滤 / 大小写不敏感 / 空查询返回全部 / 无匹配返回空）、命令模板映射正确。
- 组件：
  - 输入 `/` 弹菜单；`/se` 过滤到 `/sell`
  - ↑↓ 移动高亮，Enter 把模板填入输入框，菜单关闭、焦点留输入框
  - Esc 关闭菜单
  - 非 `/` 开头输入不弹菜单、NL 提交行为不变
  - `AiPanelView` compact 传入时渲染限高滚动容器；不传时不渲染
  - 更新后的头部提示与 unknown 话术断言
- web 现有 319 测试无回归。

## 6. 不在范围（Out of Scope）

- Cmd+K 全局命令栏、命令小表单（结构化录入）、AI 管线 / 意图 schema / 合约改动、资产页洞察布局改动。

## 7. 验收标准（Acceptance Criteria）

- **AC1**：输入 `/` 弹出可筛选命令菜单（8 命令），`/se` 过滤到 `/sell`。
- **AC2**：↑↓ 导航 + Enter/点击将对应模板填入输入框（含占位），菜单关闭、焦点留输入框；Esc 关闭。
- **AC3**：非 `/` 开头的自然语言输入行为不变，走同一提交管线。
- **AC4**：首页 MarketBrief 限高 + 内部滚动；资产页 InsightPanel 布局不变。
- **AC5**：助手头部提示与 unknown 兜底话术更新，准确覆盖读查询 + buy/sell/cancel/claim。
- **AC6**：TDD 全绿，web 现有 319 测试无回归，零数据/合约改动。
