# Tasks: RWA 叙事深化

> 每步含精确文件路径 + 变更要点 + 验证命令；粒度 2-5 分钟，codex 友好。
> 分 4 批派发。**每批完成后 Claude 审 diff**，检出 codex 常见坏习惯（乱改配色/字体/构建配置）。
> 前置约束：**不动 `HadronAssets` / `HadronMarket` 合约**；**不改现有 8 类 gradient / tickerClassName**；**docs 保持 stub 语气**；**externalLinks 只用 `demo.hadron.local`**。

## 1. 数据层 & 类别扩展（Codex 批 1，约 10-15 分钟）

- [x] 1.1 新建 `web/lib/issuers.ts`：定义 `Issuer` 类型（对应 JSON schema：slug/displayName/shortName/jurisdiction/establishedYear/focus/description/docs/externalLinks），提供 `listIssuers()` / `loadIssuerBySlug(slug)` / `issuerForAsset(assetMeta)`（未匹配抛错）/ `computeIssuerKpis(issuerSlug, assets, events)`（返回 `{ assetsCount, totalShares, cumulativeVolumeUsdc, weightedApyBps }`）。build-time 静态 import 全部 `web/content/issuers/*.json`（Vite/Next 支持的 glob import），构造 `assetIds` 反向索引。
- [x] 1.2 修改 `web/lib/categories.ts`：`DisplayCategory` 追加 `"sovereign-bonds"` / `"corporate-bonds"`；`DISPLAY_CATEGORIES` 追加两条（label `SOVEREIGN BONDS` / `CORPORATE BONDS`，按 fixed-income → hard asset 语序插到 TREASURIES 后、PRIVATE CREDIT 前）；`categoryDisplays` 追加两条 gradient/tickerClassName（sovereign 冷蓝饱和调，corporate amber-slate 调）。**不许改其他 8 类的 gradient/tickerClassName**。
- [x] 1.3 新建 `web/content/issuers/*.json` × 9（现有资产的归并 issuer），slug 与 shortName / displayName / jurisdiction 参考 `docs/plans/2026-07-06-rwa-narrative-deepening-design.md` §3.3 表：`us-treasury-desk` / `meridian-credit` / `atlas-receivables` / `harbor-real-estate` / `polaris-metals-vault` / `verra-registry-carbon` / `goldstd-carbon` / `helios-infrastructure` / `axiom-fine-art`。每个 issuer JSON docs 3 条固定 stub，externalLinks 2 条 `demo.hadron.local` 占位。
- [x] 1.4 迁移 14 个 `web/content/assets/*.json`：加 `issuerSlug` 字段（指向 §3.3 表的映射），删除 `issuer` 字符串字段。归并映射：t-bill-2026-q3 / us-t-note-2028 → us-treasury-desk；meridian-sme-credit-a → meridian-credit；atlas-trade-receivables-b / nexus-invoice-pool-2026-07 → atlas-receivables；marina-tower-12f / dockside-logistics-park → harbor-real-estate；gold-ounce-4 / silver-bullion-vault-2 → polaris-metals-vault；verra-carbon-9 → verra-registry-carbon；gold-standard-offset-bundle → goldstd-carbon；solar-farm-basin-2 / fiber-grid-metro-loop → helios-infrastructure；blue-chip-art-fraction-7 → axiom-fine-art。
- [x] 1.5 修改 `web/lib/metadata.ts`：解析层加 `issuerSlug` 必填校验；若 asset 缺字段或指向不存在 issuer，抛出明确 error（含 asset slug + 缺失原因）；确保 `npm run build` / `npm test` 触发校验（loader top-level 立即校验）。
- [x] 1.6 加校验：`web/lib/issuers.ts` 在 loader 顶层校验每个 issuer 的 `externalLinks[].href` 以 `https://demo.hadron.local/` 开头，违反抛错。
- [x] 1.7 新增测试：
  - `web/test/lib/issuers.test.ts`：`listIssuers` 返回 9 个；`loadIssuerBySlug("meridian-credit")` 找到；`loadIssuerBySlug("nope")` 返回 undefined；`issuerForAsset` 未匹配抛错；反向 `assetIds` 聚合正确。
  - `web/test/lib/issuers-kpi.test.ts`：`computeIssuerKpis` 口径固定（构造 3 fixture assets + mock events，断言 4 KPI 值；Weighted APY 用文档 Scenario 中的例子：A(5%,10M) B(10%,5M) → 6.67%）。
  - `web/test/lib/metadata.test.ts`：加两个 case —— 缺 `issuerSlug` 校验失败；指向不存在 slug 校验失败。
  - `web/test/lib/categories.test.ts`：`displayCategoryForChainCategory("sovereign-bonds")` / `"corporate-bonds"` 映射正确；`DISPLAY_CATEGORIES` 长度 = 10。
- [ ] 1.8 验证：`cd web && npm test && npm run build`；全部通过。
- [ ] 1.9 【Claude 人工审 diff】重点：14 asset JSON 是否**全部**迁移完；`categories.ts` 现有 8 类 gradient/tickerClassName 是否被误改；`metadata.ts` 校验是否 fail-fast。

## 2. Explore 过滤（Codex 批 2，约 10-15 分钟）

- [x] 2.1 新建 `web/components/market/ExploreIssuerFilter.tsx`：受控组件；props `{ issuers: Issuer[], selectedSlug: string | null, onChange: (slug: string | null) => void }`；渲染下拉，第一项 "All Issuers"，其他项显示 `displayName (assetsCount)`；键盘可达 + focus 状态遵循现有 chip/输入样式基调。
- [x] 2.2 新建 `web/components/market/ExploreYieldFilter.tsx`：受控组件；props `{ selected: YieldBucket | null, onChange: (b: YieldBucket | null) => void }`；`YieldBucket` = `"lt4" | "4to6" | "6to10" | "gt10"`（对应 apyBps `<400` / `[400,600)` / `[600,1000)` / `≥1000`）；4 chip 互斥单选（点已选 chip 取消），样式与类别 chip 一致。
- [x] 2.3 修改 Explore/首页（定位：`web/app/HomeView.tsx` 或市场目录页 —— codex 先 grep `CATEGORY_TAB_OPTIONS` 定位当前挂载）：类别 chips 下方插入两行 —— `Issuer:` 加 `ExploreIssuerFilter`、`Yield:` 加 `ExploreYieldFilter`；接入 URL search params（读写 `category` / `issuer` / `yield` / `q`）；filter 逻辑抽到纯函数 `filterAssets(assets, { category, issuerSlug, yieldBucket, query })` 便于测试；**统计条口径不动**（继续用未过滤集）。
- [x] 2.4 空态：过滤后无匹配时表格区显示 `No assets match current filters. Reset filters.` + 一个 "Reset" 按钮回到无过滤态。
- [x] 2.5 新增测试：
  - `web/test/components/market/ExploreIssuerFilter.test.tsx`：选中触发 `onChange`；渲染 "All Issuers" + 全部 issuer 项。
  - `web/test/components/market/ExploreYieldFilter.test.tsx`：点击 chip 触发 `onChange(bucket)`；再点同 chip 触发 `onChange(null)`。
  - `web/test/lib/filterAssets.test.ts`（若把 filterAssets 抽到 lib 里）：category / issuer / yield / query 单条件 + 组合 case + 边界（apyBps=400、600、1000 的桶归属）。
- [x] 2.6 验证：`cd web && npm test`（本批按沙箱说明不跑 build）。
- [ ] 2.7 【Claude 人工审 diff】重点：URL 状态往回读时是否正确 hydrate；过滤逻辑与 `filterAssets` 单测口径一致；chip 样式没引入新 Tailwind 类污染现有 token。

## 3. Issuer profile 页 + 资产详情页 patch（Codex 批 3，约 15-20 分钟）

- [ ] 3.1 新建 `web/app/issuers/[slug]/page.tsx`（Server Component）：`generateStaticParams` 返回全部 issuer slug；页面 fetch issuer + 其名下 assets meta + 传给 client 子树。若 slug 不存在返回 `notFound()`。
- [ ] 3.2 新建 `web/components/issuer/IssuerHeader.tsx`：渲染 ticker chip + displayName + jurisdiction + establishedYear + focus + description（英文一行）；面包屑 `Market > Issuers > [ShortName]`。
- [ ] 3.3 新建 `web/components/issuer/IssuerKpiBar.tsx`：4 KPI 单元（Assets / Total Shares / Cumulative Volume / Weighted APY）；接受 `IssuerKpis` props；Cumulative Volume 单元加 skeleton 状态。数字格式复用 `web/lib/format.ts`。
- [ ] 3.4 新建 `web/components/issuer/IssuerAssetsTable.tsx`：复用市场的可排序表格 —— 若市场表格已抽成独立组件（如 `AssetsTable`）则直接引入；若尚未抽出，则**只在本次抽出可复用的 `SortableAssetsTable`**（不改现有市场表格行为，只做提取），两处消费。列同市场：ticker · name · category · price · 24H · yield · qty · mcap · Trade CTA。
- [ ] 3.5 新建 `web/components/issuer/IssuerDocsCard.tsx`：渲染三条固定 stub docs（`label` + `note`），不做展开/下载交互。
- [ ] 3.6 新建 `web/components/issuer/IssuerExternalLinksCard.tsx`：渲染 externalLinks 列表，`target="_blank" rel="noopener noreferrer"`；渲染前再次断言 href 以 `demo.hadron.local` 开头（防串改）。
- [ ] 3.7 新建 `web/components/issuer/IssuerActivityList.tsx`：从 activity-feed hook 拿全局事件流，`filter(e => issuer.assetIds.includes(e.assetId))` 取前 12 条；每行 kind + asset ticker + amount + relative time + explorer link；空态 `No recent activity for this issuer.`。
- [ ] 3.8 组装 profile 页：desktop 60/40 分栏（左 Assets table，右 Docs + External links + Recent activity 堆叠），mobile 单列。
- [ ] 3.9 修改资产详情页（先 grep 找现有 asset 详情页组件，如 `web/app/asset/[id]/page.tsx` 或 `AssetDetailView`）：在 header 或 sidebar 加一行 `Issuer: <Link>{displayName}</Link>` 跳 `/issuers/[slug]`；样式与现有 header 元数据行一致。
- [ ] 3.10 新增测试：
  - `web/test/components/issuer/IssuerKpiBar.test.tsx`：给定 KPI props → 渲染 4 单元；Cumulative Volume undefined → skeleton 出现。
  - `web/test/components/issuer/IssuerActivityList.test.tsx`：filter 逻辑覆盖（属于/不属于该 issuer 的事件），空态渲染。
- [ ] 3.11 手动检查（Claude 或 Codex 报告截图）：`http://localhost:3000/issuers/meridian-credit` 页面正常渲染（无 hydration warning，四 KPI 数据合理）。
- [ ] 3.12 验证：`cd web && npm test && npm run build`；开发服务器手动过一遍 3 个页面（一个已 issuer、一个空 issuer、一个未知 slug 404）。
- [ ] 3.13 【Claude 人工审 diff】重点：`SortableAssetsTable` 抽取是否破坏市场页现有行为；`IssuerActivityList` 是否引入新的事件扫描（应复用 activity-feed hook，禁止新起 event scan）。

## 4. 新资产种子 + arc-testnet 广播（Codex 批 4，约 10 分钟；广播由用户执行）

- [ ] 4.1 新建 `web/content/issuers/*.json` × 3 新 issuer：`germany-treasury-demo`（Berlin, DE, Est. 1949）、`japan-treasury-demo`（Tokyo, JP, Est. 1949）、`apex-corporate-desk`（Delaware, US, Est. 2003）。docs/externalLinks 保持 stub。
- [ ] 4.2 新建 `web/content/assets/*.json` × 4 新资产：
  - `de-bund-10y`：ticker `BUND-10Y`, category `sovereign-bonds`, issuerSlug `germany-treasury-demo`, apyBps 320
  - `jp-jgb-5y`：ticker `JGB-5Y`, category `sovereign-bonds`, issuerSlug `japan-treasury-demo`, apyBps 80
  - `apex-industrials-2029`：ticker `APEX-29`, category `corporate-bonds`, issuerSlug `apex-corporate-desk`, apyBps 540
  - `helios-utility-2031`：ticker `HELIO-31`, category `corporate-bonds`, issuerSlug `helios-infrastructure`（复用现有 issuer 跨类别）, apyBps 590
  - description 一句话英文 demo 语气；docs 三条 stub。
- [ ] 4.3 新建 `contracts/script/Seed2026Q3RwaExpansion.s.sol`：`vm.startBroadcast()` 后 4 笔 `assets.createAsset(name, category, totalShares, metadataURI)`，参数：
  - `("German Bund 10Y Demo", "sovereign-bonds", 10_000_000, "hadron://assets/de-bund-10y")`
  - `("JGB 5Y Demo", "sovereign-bonds", 10_000_000, "hadron://assets/jp-jgb-5y")`
  - `("Apex Industrials 2029", "corporate-bonds", 5_000_000, "hadron://assets/apex-industrials-2029")`
  - `("Helios Utility Note 2031", "corporate-bonds", 5_000_000, "hadron://assets/helios-utility-2031")`
  - 参考 `SeedV5.s.sol` 的 `SeedAsset` struct 用法；不做定价/挂单，只 createAsset。
- [ ] 4.4 更新 `README.md` 或 `DEPLOYMENTS.md`（如存在）：追加广播命令样例（`--slow` + 一次性密钥）与新 asset id 记录位。
- [ ] 4.5 验证（前端只跑构建/测试）：`cd web && npm test && npm run build`；4 新 asset JSON 无 `issuerSlug` fail-fast 报错；类别过滤 `sovereign-bonds` / `corporate-bonds` 各显示 2 资产（此时 mock 或跳过链上 id 校验）。
- [ ] 4.6 【用户手动】按 memory [[arc-testnet-broadcast-practice]] 广播：
  ```
  # 用一次性密钥 SEED_PK（不复用主部署密钥）
  cd contracts
  FOUNDRY_OFFLINE=false forge script script/Seed2026Q3RwaExpansion.s.sol:Seed2026Q3RwaExpansion \
    --rpc-url $ARC_RPC --slow --broadcast \
    --private-key $SEED_PK
  ```
  广播完记录 4 个新 asset id。
- [ ] 4.7 【Claude 人工审 diff】重点：4 asset JSON `issuerSlug` 是否正确；Foundry script 不复用生产 owner 私钥的模式；不动 `SeedV5.s.sol` 或其他现有 script。
- [ ] 4.8 最终验证：广播完后本地跑 `npm run dev`，Explore 页 SOVEREIGN BONDS / CORPORATE BONDS 各 2 条；点新资产详情页 → issuer 跳 profile；profile 页 4 KPI 有值。

## 5. 归档前收尾

- [ ] 5.1 `openspec validate rwa-narrative-deepening --strict --no-interactive` 通过。
- [ ] 5.2 更新 `openspec/specs/market-browsing/spec.md`：合并本次 MODIFIED delta（10 类 chips + Issuer/Yield filter + 资产详情页 issuer 入口 + 统计条口径不变）。
- [ ] 5.3 新建 `openspec/specs/issuer-profile/spec.md` + `openspec/specs/issuer-profile/design.md`（design.md 摘录本变更 design.md 的核心决策与目录结构）。
- [ ] 5.4 提交 git，commit 信息按 `feat(web): RWA 叙事深化——Issuer profile + Sovereign/Corporate bonds + Explore 两维过滤`。
- [ ] 5.5 归档：`/openspec:archive` → 移动到 `openspec/changes/archive/2026-07-06-rwa-narrative-deepening`。
- [ ] 5.6 完整性 6 项检查（CLAUDE.md 全局 §0.7）过。
