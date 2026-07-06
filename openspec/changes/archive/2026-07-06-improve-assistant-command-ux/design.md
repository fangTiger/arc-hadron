# Design: 助手 `/` 命令菜单 + 首页 Brief 压缩 + 文案修正

> 完整设计见 `docs/plans/2026-07-06-assistant-command-ux-design.md`。本文件为 OpenSpec 归档留存摘要。

## 本质
纯前端 UX 打磨，源于用户使用 NL 助手 v2 后的三条反馈。复用现有意图 / 生成管线，零数据/合约改动。

## ① 助手 / 命令菜单
输入框以 `/` 开头弹可筛选命令菜单（8 命令），↑↓ + Enter/点击回填模板（含 `<asset>` 等占位），Esc 关闭；
NL 输入照常。命令菜单即能力发现入口。
- `commandRegistry`（纯数据）+ `filterCommands`（纯函数）+ `CommandMenu` 子组件；输入框加前导 `/` 检测与键盘导航。
- 模板：price→`price <asset>`、depth→`depth <asset>`、holdings→`my <asset> holdings`、yield→`my yield`、
  buy→`buy <qty> <asset>`、sell→`sell <qty> <asset> at <price>`、cancel→`cancel my <asset> order`、claim→`claim my yield`。

## ② 首页 MarketBrief 压缩
`AiPanelView` 加可选 `compact` prop → markdown 包进 `max-h-[16rem] overflow-y-auto` + 底部渐隐；
仅 MarketBrief（首页）传，资产页 InsightPanel 不传 → 不变。

## ③ 文案修正
头部提示 → "Type / for commands, or ask in plain English."；unknown 兜底话术补齐 sell/cancel/claim。

## 验收标准
- **AC1**：`/` 弹可筛选命令菜单（8 命令），`/se` 过滤到 `/sell`。
- **AC2**：↑↓ + Enter/点击回填模板，菜单关闭、焦点留输入框；Esc 关闭。
- **AC3**：非 `/` 开头的 NL 输入行为不变，走同一提交管线。
- **AC4**：首页 MarketBrief 限高 + 内部滚动；资产页 InsightPanel 布局不变。
- **AC5**：头部提示与 unknown 兜底话术更新，覆盖读查询 + buy/sell/cancel/claim。
- **AC6**：TDD 全绿，web 现有 319 测试无回归，零数据/合约改动。
