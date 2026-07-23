## 1. 布局契约测试（RED）

- [x] 1.1 新增全站 shell 与 TopBar 契约测试，覆盖统一对齐标记、移动双层导航和 390px 下核心入口可达性，并运行确认因实现缺失而失败。
- [x] 1.2 新增市场页契约测试，覆盖资产表局部滚动框、窄屏 LIVE ticker 非固定遮挡策略和主区 `min-width: 0`，并运行确认失败。
- [x] 1.3 新增 issuer profile 契约测试，覆盖 mobile 单列、grid item 宽度约束与 Assets table 局部滚动边界，并运行确认失败。
- [x] 1.4 新增 developer API 阅读密度与资产详情响应式 skeleton 测试，并运行确认失败。

## 2. 全局壳层与顶栏（GREEN）

- [x] 2.1 在 `globals.css` 建立 shell 最大宽度、响应式 gutter、表面层级、ticker 安全区和页面级溢出防线 token/utility。
- [x] 2.2 重构 `TopBar` 为桌面单行、手机双层紧凑布局，保留品牌、MARKET / PORTFOLIO / API、Assistant、网络状态与钱包入口。
- [x] 2.3 统一市场、资产详情、issuer、portfolio 与 developer API 页面 shell 对齐线，并运行 1.1 测试转绿。

## 3. 数据密集页面响应式修复（GREEN）

- [x] 3.1 为 MarketTable 及其父 grid 增加 `min-width: 0`、局部横向滚动边界和窄屏滚动提示，不改变排序与行交互。
- [x] 3.2 修复 issuer profile 主 grid 与 IssuerAssetsTable 的宽度约束，确保 Header、KPI 和右栏卡片不被宽表撑开。
- [x] 3.3 将 LIVE ticker 改为桌面固定且预留安全区、窄屏流式不遮挡，并保持事件/空态语义。
- [x] 3.4 运行 1.2、1.3 与现有市场/issuer 组件测试转绿。

## 4. 阅读密度与加载/空状态精修（GREEN/REFACTOR）

- [x] 4.1 调整 developer API 的移动标题、正文、代码块、端点卡片与桌面侧栏节奏，保持全部文档内容不变。
- [x] 4.2 收敛 portfolio 的页头、连接钱包空状态和订单空态在手机/桌面的 padding、最小高度与文本宽度。
- [x] 4.3 将资产详情 loading skeleton 改为响应式高度和移动单列顺序，减少连续超长空白占位。
- [x] 4.4 在测试保护下统一重复 shell/scroll-frame class 与 focus-visible 状态，运行 1.4 及相关现有测试转绿。

## 5. 验证与规范同步

- [x] 5.1 运行相关 Vitest 文件并确认零失败、零意外 warning。
- [x] 5.2 运行 `npm test`、`npm run lint` 与 `npm run build`。
- [x] 5.3 用真实 Chrome 在 390×844、768×1024、1280×720、1440×1000 检查 `/`、`/asset/1`、issuer、portfolio、developer API；确认页面 `scrollWidth === innerWidth` 且保存前后截图证据。
- [x] 5.4 对照 proposal/spec/design 核验所有场景，完成后勾选实际已完成任务并运行 `openspec validate refine-responsive-page-layouts --strict --no-interactive`。
- [x] 5.5 运行 Graphify 代码图谱重建命令并检查报告生成成功。
