## ADDED Requirements

### Requirement: 命令菜单与输入引导
助手输入框 SHALL 支持 `/` 命令：当输入以 `/` 开头时，系统 SHALL 弹出可筛选的命令菜单，涵盖 price / depth / holdings / yield / buy / sell / cancel / claim 八个命令（各含简短说明与填入模板）。用户 SHALL 可用 ↑↓ 导航、Enter 或点击选择，选择后系统 SHALL 将对应模板（含 `<asset>` / `<qty>` / `<price>` 占位）填入输入框、关闭菜单并保持输入框焦点；Esc SHALL 关闭菜单。不以 `/` 开头的自然语言输入行为 MUST 保持不变，走同一提交管线。助手头部引导与 `unknown` 兜底话术 MUST 准确覆盖读查询与 buy / sell / cancel / claim，不得仅提及 buying。命令菜单 MUST NOT 改动意图 schema 或生成管线。

#### Scenario: 斜杠弹出并筛选命令
- **WHEN** 用户在输入框输入 `/` 或 `/se`
- **THEN** 弹出命令菜单，`/` 显示全部命令、`/se` 过滤到 `sell`

#### Scenario: 选择命令回填模板
- **WHEN** 用户用 ↑↓ 高亮某命令并按 Enter（或点击）
- **THEN** 对应模板（如 `sell <qty> <asset> at <price>`）填入输入框，菜单关闭，焦点留在输入框待补参数

#### Scenario: Esc 关闭菜单
- **WHEN** 命令菜单打开时用户按 Esc
- **THEN** 菜单关闭，输入内容保留

#### Scenario: 自然语言输入不受影响
- **WHEN** 用户输入不以 `/` 开头的自然语言（如 "buy 5 HADRON"）
- **THEN** 不弹命令菜单，按原有 NL 提交管线处理
