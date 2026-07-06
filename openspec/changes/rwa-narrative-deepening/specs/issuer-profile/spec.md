# issuer-profile Specification

## ADDED Requirements

### Requirement: Issuer 元数据登记与索引

系统 SHALL 在 `web/content/issuers/` 目录下以 JSON 形式登记每个 issuer；每个 issuer 至少包含 `slug` / `displayName` / `shortName` / `jurisdiction` / `establishedYear` / `focus` / `description` / `docs` / `externalLinks`。资产 JSON MUST 通过 `issuerSlug` 字段引用 issuer。`web/lib/issuers.ts` SHALL 在构建期静态 import 全部 issuer JSON，反向聚合出每个 issuer 的 `assetIds`；issuer JSON 中禁止手写 `assetIds` 字段。

#### Scenario: 构建期发现资产缺 issuerSlug 或指向无效 slug
- **WHEN** 资产 JSON 缺少 `issuerSlug` 或 `issuerSlug` 指向不存在的 issuer
- **THEN** `npm run build` 与 `npm test` 失败并输出明确报错（fail-fast）

#### Scenario: 反向聚合正确
- **WHEN** 三个资产 JSON 的 `issuerSlug` 均为 `harbor-real-estate`
- **THEN** `loadIssuerBySlug('harbor-real-estate').assetIds` 长度为 3

### Requirement: Issuer 元数据 stub 语气与占位域名

系统 SHALL 强制 issuer JSON 的 `docs[].note` 使用 stub 语气（示例："Illustrative material, not a legal instrument."），`externalLinks[].href` MUST 使用 `demo.hadron.local` 域名占位；构建期校验违反则失败。

#### Scenario: externalLinks 指向真实企业域名
- **WHEN** issuer JSON 的 `externalLinks[].href` 使用非 `demo.hadron.local` 域名
- **THEN** 构建/测试失败并明确报错

### Requirement: Issuer profile 页布局与 KPI

系统 SHALL 提供 `/issuers/[slug]` 页面，展示：
- **Header**：Back 按钮 + ticker chip（shortName）+ displayName + jurisdiction + establishedYear + focus + 一行 description
- **KPI 栏（4 格）**：Assets（issuer 名下资产数）· Total Shares Issued（Σ `HadronAssets.totalShares(tokenId)`）· Cumulative Volume（Σ `PrimarySale.paid + Purchased.paid` 该 issuer 全部资产的历史事件金额）· Weighted APY（Σ `apyBps[i] × totalShares[i]` / Σ `totalShares[i]`）
- **主区（desktop 60/40 分栏，mobile 单列）**：左 Assets table（复用市场表格组件，可排序）；右 Docs 卡片（三条固定 stub）+ External links 卡片 + Recent activity（最多 12 条，复用 activity-feed 数据源，前端 filter `event.assetId in issuer.assetIds`）
- **面包屑**：Market > Issuers > [ShortName]

全部 UI 文案为英文。KPI 数据源 SHALL 全部由链上事件与静态元数据派生，MUST 不使用服务端聚合。

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

### Requirement: Issuer profile 页的 KPI 加载态

`Cumulative Volume` KPI 依赖链上事件扫描，未缓存命中时页面 SHALL 展示 skeleton 加载态并复用 `activity-feed` 现有 skeleton 组件；其他三个 KPI（Assets / Total Shares / Weighted APY）MUST 立即渲染（不等待事件扫描）。

#### Scenario: 首次访问触发加载
- **WHEN** 未缓存 issuer 相关事件数据时访问 profile 页
- **THEN** Cumulative Volume KPI 单元显示 skeleton，其他 KPI（Assets / Total Shares / Weighted APY）立即渲染
