## ADDED Requirements

### Requirement: 统一页面壳层与视口边界
Web 应用 SHALL 为所有公开页面提供统一的最大宽度、响应式横向 gutter 和垂直节奏。页面根布局在 390px 及以上支持视口中 MUST 不产生页面级横向滚动；需要保留最小内容宽度的数据组件 MUST 将溢出限制在自身滚动容器内。

#### Scenario: 390px 手机浏览公开页面
- **WHEN** 用户以 390px 宽视口访问市场、资产详情、issuer、portfolio 或 developer API 页面
- **THEN** 页面 `scrollWidth` 不大于视口宽度，正文与主要操作保留一致的左右 gutter

#### Scenario: 宽表格包含多列数据
- **WHEN** 数据表的可读最小宽度大于当前视口
- **THEN** 用户只在表格滚动框中横向滚动，页面标题、侧栏和后续内容保持在视口内

### Requirement: 响应式顶栏与导航可达性
顶栏 SHALL 在桌面保持单行交易终端布局，在窄屏采用不会撑宽页面的紧凑布局。MARKET、PORTFOLIO 与 API 主导航在所有支持视口 MUST 可见或通过明确控件可达；品牌、Assistant、网络状态和钱包操作 MUST NOT 共同制造横向溢出。

#### Scenario: 未连接钱包的手机顶栏
- **WHEN** 未连接钱包的用户以 390px 视口访问任意页面
- **THEN** 顶栏不产生横向滚动，用户仍能访问 MARKET、PORTFOLIO、API、Assistant 与连接钱包入口

#### Scenario: 桌面顶栏对齐
- **WHEN** 用户以 1280px 或更宽视口浏览页面
- **THEN** 顶栏品牌和操作区与页面主 shell 的左右对齐线一致

### Requirement: 阅读尺度与表面层级
系统 SHALL 区分交易数据密度与长文阅读密度：市场数字和辅助标签可保持紧凑 mono 排版，文档正文、说明文字、空状态和标题 MUST 在窄屏保持可读字号、行高与段落间距。卡片、分区和代码块 SHALL 使用一致的边框、背景与 focus/hover 层级。

#### Scenario: 手机阅读 developer API
- **WHEN** 用户以窄屏浏览 developer API 长文档
- **THEN** 标题、正文和代码块具有清晰层级，代码块可局部横向滚动，正文无需缩放即可阅读

#### Scenario: 浏览空状态
- **WHEN** portfolio 或市场组件没有数据或需要连接钱包
- **THEN** 空状态在手机和桌面都保持适度高度、清晰主次文案和可达的主要操作

### Requirement: 响应式加载占位
加载 skeleton SHALL 近似最终布局并使用响应式高度。窄屏加载态 MUST NOT 因复用桌面固定高度而产生连续超长空白块，且加载布局 MUST 遵守页面级无横向溢出约束。

#### Scenario: 手机加载资产详情
- **WHEN** 资产详情的链上数据在 390px 视口尚未返回
- **THEN** skeleton 以紧凑单列顺序展示并控制各占位块高度，页面不被撑宽且不会出现与最终内容无关的超长空白
