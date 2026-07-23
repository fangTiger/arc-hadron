## MODIFIED Requirements

### Requirement: Issuer profile 页布局与 KPI

系统 SHALL 提供 `/issuers/[slug]` 页面，展示：
- **Header**：Back 按钮 + ticker chip（shortName）+ displayName + jurisdiction + establishedYear + focus + 一行 description
- **KPI 栏（4 格）**：Assets（issuer 名下资产数）· Total Shares Issued（Σ `HadronAssets.totalShares(tokenId)`）· Cumulative Volume（Σ `PrimarySale.paid + Purchased.paid` 该 issuer 全部资产的历史事件金额）· Weighted APY（Σ `apyBps[i] × totalShares[i]` / Σ `totalShares[i]`）
- **主区（desktop 60/40 分栏，mobile 单列）**：左 Assets table（复用市场表格组件，可排序）；右 Docs 卡片（三条固定 stub）+ External links 卡片 + Recent activity（最多 12 条，复用 activity-feed 数据源，前端 filter `event.assetId in issuer.assetIds`）
- **面包屑**：Market > Issuers > [ShortName]

全部 UI 文案为英文。KPI 数据源 SHALL 全部由链上事件与静态元数据派生，MUST 不使用服务端聚合。mobile 单列布局 MUST 限制每个 grid item 的最小宽度；Assets table 只可在自身滚动容器内横向溢出，Header、KPI 与右侧卡片 MUST 保持在视口宽度内，页面根节点不得被资产表撑宽。

#### Scenario: 访问 issuer profile 页
- **WHEN** 访客访问 `/issuers/meridian-credit`
- **THEN** 页面展示 Meridian 的 Header + 4 KPI + 名下资产 table + Docs + External links + Recent activity；数据与首页/资产页一致

#### Scenario: 从 issuer profile 页返回
- **WHEN** 访客点击 Header 中的 "Back" 按钮
- **THEN** 系统优先调用浏览器历史返回；若没有上一条历史记录，则跳转到 Market 首页

#### Scenario: KPI Weighted APY 口径
- **WHEN** issuer 名下 2 资产：A（apy 5%, shares 10M）B（apy 10%, shares 5M）
- **THEN** Weighted APY = (5×10 + 10×5)/(10+5) = 6.67%

#### Scenario: Recent activity 空态
- **WHEN** issuer 名下资产在链上无成交事件
- **THEN** Recent activity 区展示 "No recent activity for this issuer."

#### Scenario: 手机浏览 issuer profile
- **WHEN** 用户以 390px 视口访问包含多列资产表的 issuer profile
- **THEN** Header、KPI、Docs、External links 与 Recent activity 保持在视口内，只有 Assets table 的滚动框可以横向滚动
