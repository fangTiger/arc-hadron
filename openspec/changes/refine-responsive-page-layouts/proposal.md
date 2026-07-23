## Why

HADRON 当前各页面虽然共享深色交易终端视觉，但缺少统一的响应式壳层规则：真实 390px 视口会被顶栏撑到 447px，issuer 资产表会把页面撑到约 998px，首页 LIVE ticker 遮挡内容，页面容器、阅读尺度和加载占位也不一致。需要在保留“紧凑、交易优先”产品方向的前提下，系统修复跨页面布局与视觉层级。

## What Changes

- 建立统一页面壳层、内容宽度、横向 gutter、垂直节奏和窄屏断点规则，使市场、资产、issuer、portfolio、developer API 在同一视觉网格上对齐。
- 重做顶栏的窄屏布局：品牌、主导航、Assistant、网络状态和钱包操作不得共同制造横向溢出，并保证移动端仍能访问主导航。
- 修复数据密集型组件的窄屏策略：市场表和 issuer 资产表在自己的滚动容器内横向滚动，页面本身不得被表格撑宽；提供明确的滚动边界或提示。
- 调整市场页筛选区、侧栏与 LIVE ticker 的响应式行为，保持交易优先和紧凑密度，同时避免 ticker 覆盖主内容。
- 提升 developer API 长文档在手机与桌面的阅读尺度、段落节奏、代码块和侧栏布局，减少过小字体造成的视觉疲劳。
- 收敛 portfolio、issuer 与资产详情加载/空状态的高度、留白和层级，避免移动端出现过长空白占位。
- 增加布局契约测试，并使用桌面与移动真实浏览器截图回归验证关键路由。
- 不改变交易数据、钱包、链上读取、URL 过滤参数或 API 语义。

## Capabilities

### New Capabilities

- `responsive-layout`: 定义全站页面壳层、顶栏导航、响应式溢出控制、阅读尺度、加载占位与跨页面视觉一致性。

### Modified Capabilities

- `market-browsing`: 补充市场页与资产详情在窄屏下的表格、筛选区、交易 rail、LIVE ticker 和加载占位要求。
- `issuer-profile`: 明确 issuer profile 的 mobile 单列必须限制页面宽度，资产表只能在局部滚动容器内溢出。

## Impact

- Affected code: `web/app/layout.tsx`、`web/app/globals.css`、各路由页面壳层、`web/components/layout/TopBar.tsx`、市场/issuer 表格、LIVE ticker、资产详情 loading 与 developer API 文档布局。
- Affected tests: 视觉 token、顶栏、市场组件、issuer profile、developer API 与新增布局契约测试。
- Dependencies/APIs: 不新增运行时依赖，不改公共 API、合约、数据模型和交易流程。
