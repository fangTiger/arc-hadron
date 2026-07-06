# HADRON — RWA 叙事深化设计（Issuer profile + 新增两类 + Explore 维度）

> Brainstorming 产出 · 2026-07-06 · Superpowers 中任务流程
> 决策来源：Q1（Issuer 纯元数据）· Q2（新增 sovereign + corporate bonds）· Q3（Explore 加 Issuer filter + Yield bucket）· Q4（Issuer profile 聚焦版）· Q5（种子中等规模）
> 实现分工：**Claude 设计 + 审 diff；Codex MCP 落地代码**（memory: [[claude-designs-codex-implements]]、[[codex-sandbox-workarounds-review]]）

---

## Context

- HADRON 已完成 M1-M5 + AI 层 + 买单深度 + 收益分配（2026-07 三件套）。资产层现有 14 种子资产覆盖 8 类别；每个资产 JSON 已含 `issuer` 自由字符串，但**没有 issuer 主体页**、Explore **没有 issuer 维度**、fixed-income 家族缺主权/企业公开债。
- 本变更为 RWA 叙事深化：把 issuer 从字符串升级为结构化实体、补两类 fixed-income、Explore 加 issuer/yield 两维过滤。**不动合约**；只在元数据 + 前端 + 种子脚本层展开。
- 交付形态：Codex 按 tasks.md 逐步实现，Claude 审每一批 diff。

## Goals / Non-Goals

**Goals:**
- Issuer 结构化：新增 `web/content/issuers/*.json` + 资产 JSON 引用 `issuerSlug`；构建期 fail-fast 校验。
- Issuer profile 页 `/issuers/[slug]`：Header + KPI 栏 + Assets table + Docs + Recent activity。KPI 全由链上事件 + 静态元数据派生。
- 新增两类 `sovereign-bonds`、`corporate-bonds`，共 4 资产种子。
- Explore 新增 Issuer filter + Yield bucket 两维过滤，URL 状态可分享。
- 资产详情页加 issuer 跳转入口。
- 保持"所见即链上"叙事（KPI 数据源全部链上派生）。

**Non-Goals:**
- 不改 `HadronAssets` / `HadronMarket` 合约；不动 issuer 上链。
- 不上真 PDF/审计报告文件（docs 保持 stub 语气）；不引真实企业域名（externalLinks 用 `demo.hadron.local` 占位）。
- 不做 issuer 侧的历史发行 timeline chart（数据点稀疏，Q4 已否决）。
- 不加 risk tier / maturity filter（Q3 已否决）。
- 不做 Explore 表格的 issuer 列（保信息密度，Q3 隐含约束）。

## Decisions

| # | 决策 | 选择 | 备选与否决理由 |
|---|------|------|--------------|
| 1 | Issuer 数据层 | 纯元数据（off-chain JSON） | 链上 registry 需要合约迁移 + testnet 重播，本次改动边际收益低；混合方案（uint16 issuerId 上链无 registry）不比纯元数据更强 |
| 2 | 新增类别 | Sovereign bonds + Corporate bonds | Music/RE-notes 有 RWA 猎奇感（反用户品味）；Fund/basket 需要合约层价格聚合逻辑，超出本次边界 |
| 3 | Explore 新维度 | Issuer filter + Yield bucket 两维 | Maturity 只对 fixed-income 家族有值，其余类别显示 "—" 掉密度；Risk tier 需要主观分级 metadata，易变营销标签 |
| 4 | Yield bucket 交互 | 4 chip 互斥单选（`<4%` / `4-6%` / `6-10%` / `>10%`） | 多选累加会让当前状态难解释；单选与类别 chip 交互一致 |
| 5 | Issuer profile 内容 | Header + KPI + Assets table + Docs + Recent activity | 完整版含 issuance timeline chart —— 每 issuer 平均 2-4 资产，时间轴数据点稀疏会掉密度；极简版没 activity 区，交易所感弱 |
| 6 | Weighted APY 权重 | 按 `totalShares` 加权 | 按 USDC value 需依赖"最新成交价" fallback，链路长、缓存依赖重；shares 加权口径简单可解释 |
| 7 | Recent activity 数据源 | 复用 `activity-feed`，前端 filter `assetId in issuer.assetIds` | 独立数据源需要新一遍分块扫描；filter 方案零成本、天然与全局一致 |
| 8 | Issuer docs 深度 | 三条固定 stub + `demo.hadron.local` 占位链接 | 上真 PDF 需要托管 + 合规审查；引真实企业域名有法律/误导风险 |
| 9 | 资产表格是否加 issuer 列 | 不加 | 保信息密度；改在资产详情页 header 单行入口 + Explore 侧 Issuer filter 双通道 |
| 10 | 现有资产 issuer 归并 | 归并到 6-7 个 issuer（约 2 资产/issuer） | 每 issuer 单资产的 profile 页会显空；过度合并会失真（如 Verra vs Gold Standard 是不同 registry） |

## §1 数据模型与文件结构

### 1.1 类别扩展

`web/lib/categories.ts` `DisplayCategory` 加两值：`"sovereign-bonds"`（label `SOVEREIGN BONDS`）、`"corporate-bonds"`（label `CORPORATE BONDS`）。

Chain `category` 字符串照旧走 `displayCategoryForChainCategory` 映射，unknown 落到 `real-estate` fallback 不变。gradient/tickerClassName：
- sovereign-bonds：冷蓝调，参考现有 treasuries 但更饱和（Codex 落地时给 diff，Claude 审）
- corporate-bonds：amber-slate 调（表企业信用感，区别 treasuries 的青色）

### 1.2 Issuer 元数据 schema

新增 `web/content/issuers/*.json`：

```json
{
  "slug": "meridian-credit",
  "displayName": "Meridian Credit Management LP",
  "shortName": "MERIDIAN",
  "jurisdiction": "Delaware, US",
  "establishedYear": 2011,
  "focus": "Middle-market private credit",
  "description": "Two-sentence demo blurb, mirrors asset-level stub tone. Not a legal entity.",
  "docs": [
    { "label": "Entity registration", "note": "Demo document, not a legal instrument. Placeholder for issuer registration filing." },
    { "label": "Audit letter",       "note": "Demo document, not a legal instrument. Placeholder for annual audit summary." },
    { "label": "ISIN registry",      "note": "Demo document, not a legal instrument. Placeholder for identifier reference." }
  ],
  "externalLinks": [
    { "label": "Website",     "href": "https://demo.hadron.local/meridian" },
    { "label": "Disclosures", "href": "https://demo.hadron.local/meridian/disclosures" }
  ]
}
```

约束：
- `slug` 必须 kebab-case，与文件名一致
- `docs` 三条固定，`note` 保持 stub 语气（"Demo document, not a legal instrument."）
- `externalLinks[].href` **强制** `demo.hadron.local` 域名（`issuers.ts` loader 校验）

### 1.3 资产 schema 变更（`web/content/assets/*.json`）

- **新增字段** `issuerSlug: string`（必填，外键指向 `web/content/issuers/*.json`）
- **删除字段** `issuer: string`（原自由字符串 → 迁移到 issuer JSON 的 `displayName`）
- 其他字段（`slug` / `displayName` / `ticker` / `description` / `apyBps` / `docs`）保持不变

### 1.4 库层新增

- `web/lib/issuers.ts`：
  - `Issuer` 类型（对应 JSON schema）
  - `listIssuers(): Issuer[]`
  - `loadIssuerBySlug(slug: string): Issuer | undefined`
  - `issuerForAsset(assetMeta): Issuer`（未匹配抛错）
  - `computeIssuerKpis(issuerSlug, assets, events): IssuerKpis`（Assets / TotalShares / CumulativeVolume / WeightedApyBps）
  - 静态 import 全部 issuer JSON（build-time）
- `web/lib/metadata.ts`：解析层加入 `issuerSlug` 校验；若资产 JSON 缺 `issuerSlug` 或指向不存在的 issuer，**构建报错**（fail-fast，防止 Codex 忘记回填 —— 见 memory [[codex-sandbox-workarounds-review]]）

### 1.5 目录结构

```
web/content/
├── assets/                              (18 JSON，其中 4 个新)
└── issuers/                             (新目录，8-9 JSON)

web/lib/issuers.ts                       (新)
web/app/issuers/[slug]/page.tsx          (新，Server Component)
web/components/issuer/IssuerHeader.tsx   (新)
web/components/issuer/IssuerKpiBar.tsx   (新)
web/components/issuer/IssuerAssetsTable.tsx  (新，复用 sortable 表格逻辑)
web/components/issuer/IssuerDocsCard.tsx (新)
web/components/issuer/IssuerActivityList.tsx  (新)
web/components/market/ExploreIssuerFilter.tsx (新)
web/components/market/ExploreYieldFilter.tsx  (新)
```

## §2 UI 设计

### 2.1 Issuer profile page `/issuers/[slug]`

**布局（desktop）：**

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Market > Issuers > MERIDIAN                                                │
├────────────────────────────────────────────────────────────────────────────┤
│ [MERIDIAN]  Meridian Credit Management LP · Delaware, US · Est. 2011       │
│             Focus: Middle-market private credit                            │
│                                                                            │
│ Assets 2 │ Total Shares 8.5M │ Cum. Volume 142,306 USDC │ Wtd APY 8.42%   │
├──────────────────────────────────────┬─────────────────────────────────────┤
│ ASSETS                              │ DOCS                                │
│ ┌──────────────────────────────┐    │ · Entity registration               │
│ │ ticker · name · cat · price  │    │ · Audit letter                      │
│ │        · 24H · yield · qty   │    │ · ISIN registry                     │
│ │        · mcap · [Trade]      │    │                                     │
│ │  (sortable, reuses market    │    │ EXTERNAL LINKS                      │
│ │   table row component)       │    │ · Website ↗                         │
│ └──────────────────────────────┘    │ · Disclosures ↗                     │
│                                     │                                     │
│                                     │ RECENT ACTIVITY (this issuer)       │
│                                     │ · 12 rows, filtered activity feed  │
│                                     │ · each row → explorer link          │
└──────────────────────────────────────┴─────────────────────────────────────┘
```

- Desktop 60/40 分栏，mobile 单列堆叠
- Assets table 直接复用 `web/components/market/AssetsTable`（若存在）或抽出 `SortableAssetsTable` 组件由两处共用
- Recent activity 上限 12 条，"View all →" 跳全局 activity 面板

### 2.2 Explore 变化

现有 chips: `[ALL] [TREASURIES] [PRIVATE CREDIT] ... [INVOICE FINANCING]` → 扩展为 10 chips（加 `[SOVEREIGN BONDS]` `[CORPORATE BONDS]`）。

在类别 chips 下方新增两行：

```
Issuer:  [ All Issuers ▼ ]     Yield:  [ <4% ]  [ 4-6% ]  [ 6-10% ]  [ >10% ]
```

- **Issuer 下拉**：默认 "All Issuers"，展开显示全部 issuer + 每个 issuer 名下资产数（如 `Meridian Credit Management LP (2)`）
- **Yield chip 互斥单选**：点已选 chip 取消，选中另一个自动切换。默认无选中（"any yield"）
- **URL 状态**：`?category=corporate-bonds&issuer=meridian-credit&yield=6-10`
- **多维过滤组合规则**：交集（AND）
- **统计条口径**：TVL / 24H Volume / Avg APY **保持全局口径，不随过滤变化**（现有 `market-browsing` spec 定义的全局统计不变；避免本次扩大 spec 面）

### 2.3 现有资产详情页微调

Header 或 sidebar 区域加一行：

```
Issuer:  Meridian Credit Management LP  →
```

链接到 `/issuers/meridian-credit`。**这是资产详情页唯一 patch**。

## §3 数据流 / 口径 / 种子归并 / 测试

### 3.1 KPI 计算口径（Issuer profile 顶栏）

全部函数体在 `web/lib/issuers.ts::computeIssuerKpis`，无服务端：

- **Assets**: `issuer.assetIds.length` —— **单一真相是 asset JSON 的 `issuerSlug`**，`issuers.ts` loader 在 build-time 反向聚合出每个 issuer 的 `assetIds: string[]`。issuer JSON 里不写 `assetIds` 字段（避免双向失同步）。
- **Total Shares Issued**: `Σ HadronAssets.totalShares(tokenId)`（getter 读取，参考 `web/lib/marketMetrics.ts` 模式）
- **Cumulative Volume**: `Σ (PrimarySale.paid + Purchased.paid)` 该 issuer 全部 assetId 的历史事件金额（复用 `web/lib/marketEventCache.ts` 分块 + localStorage 缓存，天然与全局一致）
- **Weighted APY**: `Σ (apyBps[i] × totalShares[i]) / Σ totalShares[i]`（按 shares 加权，避开 USDC value 依赖）

单位与格式：Volume 用 `format.ts::formatUsdcCompact`，APY 用现有 bps → `%` 格式。

### 3.2 Recent activity（Issuer profile）

`IssuerActivityList` 组件：
- 输入：`issuerSlug`
- 逻辑：从 activity-feed hook 拿全局事件流（React Query 缓存复用），前端 `filter(event => issuer.assetIds.includes(event.assetId))`，取前 12 条
- 每条渲染：event kind + asset ticker + amount + relative time + explorer link
- 空态："No recent activity for this issuer."

### 3.3 现有 14 资产 issuer 归并方案（初步）

**规则**：优先按叙事发行方合并，避免过度合并（如不同 registry 不合并）。

| Issuer slug | displayName | shortName | jurisdiction | 挂载资产 |
|---|---|---|---|---|
| `us-treasury-desk` | US Treasury Desk (Demo) | UST | Washington DC, US | t-bill-2026-q3, us-t-note-2028 |
| `meridian-credit` | Meridian Credit Management LP | MERIDIAN | Delaware, US | meridian-sme-credit-a |
| `atlas-receivables` | Atlas Receivables Partners | ATLAS | Singapore | atlas-trade-receivables-b, nexus-invoice-pool-2026-07 |
| `harbor-real-estate` | Harbor Real Estate Partners | HARBOR | New York, US | marina-tower-12f, dockside-logistics-park |
| `polaris-metals-vault` | Polaris Metals Vault | POLARIS | Zurich, CH | gold-ounce-4, silver-bullion-vault-2 |
| `verra-registry-carbon` | Verra-Registry Carbon Aggregator | VERRA | Washington DC, US | verra-carbon-9 |
| `goldstd-carbon` | Gold Standard Offset Aggregator | GOLDSTD | Geneva, CH | gold-standard-offset-bundle |
| `helios-infrastructure` | Helios Infrastructure Partners | HELIOS | London, UK | solar-farm-basin-2, fiber-grid-metro-loop |
| `axiom-fine-art` | Axiom Fine Art Partners | AXIOM | London, UK | blue-chip-art-fraction-7 |

**归并结果**：9 个 issuer（现有 14 资产）。其中 3 个 issuer 单挂 1 资产（Meridian / Verra / Gold Standard / Axiom）—— 属于叙事真实需要，不强行凑数。

### 3.4 新增 4 资产 + 2 新 issuer

**Sovereign bonds** (2 资产):
- `de-bund-10y`：German Bund 10Y Demo, apy 3.20%, totalShares 10M, price 100.00 USDC
- `jp-jgb-5y`：JGB 5Y Demo, apy 0.80%, totalShares 10M, price 100.00 USDC
- Issuer: `federal-central-treasury` (Federal Central Treasury Demo Desk, Berlin/Tokyo joint demo)

**Corporate bonds** (2 资产):
- `apex-industrials-2029`：Apex Industrials 2029, apy 5.40%, totalShares 5M, price 100.00 USDC
- `helios-utility-2031`：Helios Utility Note 2031, apy 5.90%, totalShares 5M, price 100.00 USDC
- Issuer: `apex-corporate-desk`（Apex Industrials Treasury）挂 `apex-industrials-2029`；`helios-infrastructure` 复用挂 `helios-utility-2031`（跨类别是 feature，profile 页 assets table 天然按 category 分组显示）

**新增后总 issuer 数**：默认按 Open Questions 拆分 sovereign 为 `germany-treasury-demo` + `japan-treasury-demo` 两家 + `apex-corporate-desk` 一家 + `helios-infrastructure` 复用 = 9 + 3 = **12 个 issuer**。

### 3.5 测试策略

**vitest 单元/组件测**：
- `web/test/lib/issuers.test.ts`：`listIssuers` / `loadIssuerBySlug` / `issuerForAsset`（未匹配抛错）
- `web/test/lib/issuers-kpi.test.ts`：`computeIssuerKpis`（口径固定：3 fixture assets × mock events → 期望 4 KPI 值）
- `web/test/lib/metadata.test.ts`：加 `issuerSlug` 校验 —— 缺失字段构建报错、指向不存在 slug 构建报错
- `web/test/lib/categories.test.ts`：`sovereign-bonds` / `corporate-bonds` 映射覆盖
- `web/test/components/issuer/IssuerKpiBar.test.tsx`：渲染 4 KPI 单元格
- `web/test/components/market/ExploreYieldFilter.test.tsx`：4 chip 互斥点击行为
- `web/test/components/market/ExploreIssuerFilter.test.tsx`：下拉选中触发 `onIssuerChange`

**合约侧**：无变更，无测试。

**arc-testnet 冒烟**（memory [[arc-testnet-broadcast-practice]]）：
- 新 script `contracts/script/Seed2026Q3RwaExpansion.s.sol`：`vm.startBroadcast()` → 4 笔 `assets.createAsset(...)`
- 广播命令：`forge script ... --rpc-url $ARC_RPC --slow --broadcast`（`FOUNDRY_OFFLINE=false`）
- 部署产物：追加到 `web/lib/contracts.ts` 的 asset id 列表（若前端硬编码 asset id，Codex 需查明并同步）
- 用一次性密钥（防 nonce 撞车）

## Risks / Trade-offs

- **Codex 迁移遗漏**：14 个资产 JSON 都要加 `issuerSlug`，若 Codex 漏了几个，`metadata.ts` 构建期校验会兜住（fail-fast）。审 diff 时重点看 JSON 迁移完整性。
- **Codex 乱改配色/字体**（memory [[codex-sandbox-workarounds-review]]）：本变更涉及新配色（sovereign-bonds / corporate-bonds gradient）—— 明确要求 Codex 只加两条新映射，不动其他 8 类的现有 gradient/tickerClassName；审 diff 时逐字段对照。
- **KPI 缓存首屏 loading**：Cumulative Volume 依赖 event scan，首访 issuer profile 页时可能出现 loading 状态。方案：复用现有 activity-feed 的 skeleton 组件，与全局一致。
- **Issuer 数据源单点风险**：全部 JSON 静态，若某 issuer 挂的资产在测试网被 owner 意外调用 `closePrimaryOffering` 收回 —— 前端会显示"该 issuer 无活跃资产"。属于测试网正常噪声，不专门处理。
- **URL 状态复杂度**：`?category=&issuer=&yield=` 三维组合可能出现无匹配空态。空态提示"No assets match current filters. Reset filters."
- **arc-testnet 广播失败**：追加 4 笔 createAsset 若 nonce/gas 失败，用 memory 里的 `--slow` 策略；失败可安全重试（`createAsset` 无幂等要求，重复调用只是多创建 asset）。

## Migration Plan

无破坏性合约变更。前端侧：
1. Codex 先建 issuer JSON + `issuers.ts` loader（含 fail-fast 校验）
2. 迁移 14 资产 JSON 加 `issuerSlug`（删 `issuer` 字符串字段）—— **构建期立刻爆错抓漏**
3. 新增 Issuer profile 页 + Explore 过滤组件
4. arc-testnet 追加 4 笔 createAsset
5. 前端补齐新 4 资产 JSON（含 `issuerSlug`）

回滚：所有前端改动为纯代码，可 git revert；testnet 上多出来的 4 asset id 无害（前端过滤即隐藏，或用 owner 调 `closePrimaryOffering` 回收库存）。

## Open Questions

- 现有 14 资产的 `issuer` 字符串迁移到哪些 issuer JSON —— 归并方案 §3.3 是初稿，Claude 审 Codex diff 时可能微调（如把 nexus-invoice 从 atlas-receivables 独立出来 as `nexus-finance`）。**决策权在 Claude，无需再问用户**。
- 新增 sovereign 资产 issuer 是否拆成 `germany-treasury-demo` + `japan-treasury-demo` 两家（更真实），还是合并成 `federal-central-treasury` 一家占位 —— 倾向拆两家，profile 页密度不受影响（各挂 1 资产也可接受，因为主权级别叙事）。**Codex diff 里默认拆两家**。

---

*本设计文档为 brainstorming 产出，将进入 OpenSpec proposal 阶段，tasks.md 按 bite-sized 步骤下发 Codex。*
