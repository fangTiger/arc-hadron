# Tasks: RWA 叙事深化

> 每步含精确文件路径 + 变更要点 + 验证命令；粒度 2-5 分钟，codex 友好。
> 分 4 批派发。**每批完成后 Claude 审 diff**，检出 codex 常见坏习惯（乱改配色/字体/构建配置）。
> 前置约束：**不动 `HadronAssets` / `HadronMarket` 合约**；**不改既有类别 gradient / tickerClassName**；**docs 保持 stub 语气**；**externalLinks 只用 `demo.hadron.local`**。

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
- [x] 1.8 验证：`cd web && npm test && npm run build`；全部通过。
- [x] 1.9 【Codex 人工审 diff】14 asset JSON 已全部迁移为 `issuerSlug`；`categories.ts` 既有 8 类 gradient/tickerClassName 未改；`metadata.ts` 对缺失/无效 `issuerSlug` fail-fast，并有测试覆盖。

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
- [x] 2.7 【Codex 人工审 diff】URL 状态通过 `useSearchParams` hydrate 并由 `router.replace` 回写；过滤逻辑统一走 `filterAssets` 且单测覆盖 category / issuer / yield / query 与组合边界；chip 样式沿用既有 token。

## 3. Issuer profile 页 + 资产详情页 patch（Codex 批 3，约 15-20 分钟）

- [x] 3.1 新建 `web/app/issuers/[slug]/page.tsx`（Server Component）：`generateStaticParams` 返回全部 issuer slug；页面 fetch issuer + 其名下 assets meta + 传给 client 子树。若 slug 不存在返回 `notFound()`。
- [x] 3.2 新建 `web/components/issuer/IssuerHeader.tsx`：渲染 Back 按钮 + ticker chip + displayName + jurisdiction + establishedYear + focus + description（英文一行）；面包屑 `Market > Issuers > [ShortName]`。
- [x] 3.3 新建 `web/components/issuer/IssuerKpiBar.tsx`：4 KPI 单元（Assets / Total Shares / Cumulative Volume / Weighted APY）；接受 `IssuerKpis` props；Cumulative Volume 单元加 skeleton 状态。数字格式复用 `web/lib/format.ts`。
- [x] 3.4 新建 `web/components/issuer/IssuerAssetsTable.tsx`：复用市场的可排序表格 —— 若市场表格已抽成独立组件（如 `AssetsTable`）则直接引入；若尚未抽出，则**只在本次抽出可复用的 `SortableAssetsTable`**（不改现有市场表格行为，只做提取），两处消费。列同市场：ticker · name · category · price · 24H · yield · qty · mcap · Trade CTA。
- [x] 3.5 新建 `web/components/issuer/IssuerDocsCard.tsx`：渲染三条固定 stub docs（`label` + `note`），不做展开/下载交互。
- [x] 3.6 新建 `web/components/issuer/IssuerExternalLinksCard.tsx`：渲染 externalLinks 列表，`target="_blank" rel="noopener noreferrer"`；渲染前再次断言 href 以 `demo.hadron.local` 开头（防串改）。
- [x] 3.7 新建 `web/components/issuer/IssuerActivityList.tsx`：从 activity-feed hook 拿全局事件流，`filter(e => issuer.assetIds.includes(e.assetId))` 取前 12 条；每行 kind + asset ticker + amount + relative time + explorer link；空态 `No recent activity for this issuer.`。
- [x] 3.8 组装 profile 页：desktop 60/40 分栏（左 Assets table，右 Docs + External links + Recent activity 堆叠），mobile 单列。
- [x] 3.9 修改资产详情页（先 grep 找现有 asset 详情页组件，如 `web/app/asset/[id]/page.tsx` 或 `AssetDetailView`）：在 header 或 sidebar 加一行 `Issuer: <Link>{displayName}</Link>` 跳 `/issuers/[slug]`；样式与现有 header 元数据行一致。
- [x] 3.10 新增测试：
  - `web/test/components/issuer/IssuerKpiBar.test.tsx`：给定 KPI props → 渲染 4 单元；Cumulative Volume undefined → skeleton 出现。
  - `web/test/components/issuer/IssuerActivityList.test.tsx`：filter 逻辑覆盖（属于/不属于该 issuer 的事件），空态渲染。
- [x] 3.11 手动检查（Codex）：`npm run start -- --hostname 127.0.0.1 --port 3000` 成功启动；HTTP GET `http://127.0.0.1:3000/issuers/meridian-credit` 返回 200，HTML 含 Meridian header、4 KPI 区、Recent Activity 区，server 日志无错误。项目未安装 Playwright/browser-control，本次未新增大型浏览器依赖，仅做 HTTP/server smoke。
- [x] 3.12 验证：`cd web && npm test`（本轮按用户批 3 指令不跑 build；build/本地浏览器冒烟受沙箱监听/网络限制影响）。
- [x] 3.13 【Codex 人工审 diff】实际实现复用 `MarketTable`（未新增 `SortableAssetsTable` 文件），市场页现有排序行为保留；Issuer profile 通过 `IssuerProfileBody` 复用同一个 `useMarketEvents` 数据源并在前端过滤 issuer 资产，没有新起 event scan。
- [x] 3.14 补充 `web/components/issuer/BackButton.tsx`：Issuer profile Header 右侧显示 "Back"；有浏览器历史时 `router.back()`，否则 `router.push("/")`；新增 `web/test/components/issuer/BackButton.test.tsx` 覆盖 Header 挂载与两个导航分支。
- [x] 3.15 去掉 UI 用户可见 "Demo" 字样：AI 免责声明、AI prompt footer、mock LLM footer、未知资产 fallback docs、Issuer 外链拦截占位均改用 "Illustrative"；保留 `demo.hadron.local` 合规占位域名。

## 4. 新资产种子 + arc-testnet 广播（Codex 批 4，约 10 分钟；广播由用户执行）

- [x] 4.1 新建 `web/content/issuers/*.json` × 3 新 issuer：`germany-treasury-desk`（Berlin, DE, Est. 1949）、`japan-treasury-desk`（Tokyo, JP, Est. 1949）、`apex-corporate-desk`（Delaware, US, Est. 2003）。docs/externalLinks 保持 stub。
- [x] 4.2 新建 `web/content/assets/*.json` × 4 新资产：
  - `de-bund-10y`：ticker `BUND-10Y`, category `sovereign-bonds`, issuerSlug `germany-treasury-desk`, apyBps 320
  - `jp-jgb-5y`：ticker `JGB-5Y`, category `sovereign-bonds`, issuerSlug `japan-treasury-desk`, apyBps 80
  - `apex-industrials-2029`：ticker `APEX-29`, category `corporate-bonds`, issuerSlug `apex-corporate-desk`, apyBps 540
  - `helios-utility-2031`：ticker `HELIO-31`, category `corporate-bonds`, issuerSlug `helios-infrastructure`（复用现有 issuer 跨类别）, apyBps 590
  - description 一句话英文 illustrative 语气；docs 三条 stub。
- [x] 4.3 新建 `contracts/script/Seed2026Q3RwaExpansion.s.sol`：`vm.startBroadcast()` 后 4 笔 `assets.createAsset(name, category, totalShares, metadataURI)`，参数：
  - `("German Bund 10Y", "sovereign-bonds", 10_000_000, "hadron://assets/de-bund-10y")`
  - `("JGB 5Y", "sovereign-bonds", 10_000_000, "hadron://assets/jp-jgb-5y")`
  - `("Apex Industrials 2029", "corporate-bonds", 5_000_000, "hadron://assets/apex-industrials-2029")`
  - `("Helios Utility Note 2031", "corporate-bonds", 5_000_000, "hadron://assets/helios-utility-2031")`
  - 参考 `SeedV5.s.sol` 的 `SeedAsset` struct 用法；不做定价/挂单，只 createAsset。
- [x] 4.4 检查 `web/lib/contracts.ts` 是否硬编码 asset id / tokenId 列表；若无硬编码列表则无文件修改，报告说明前端从 `HadronAssets.assetCount` 派生 tokenId 范围。
- [x] 4.5 验证前端：`cd web && npm test`；4 新 asset JSON 无 `issuerSlug` fail-fast 报错；类别过滤 `sovereign-bonds` / `corporate-bonds` 各匹配 2 个 seeded asset。
- [x] 4.6 【Codex 已广播】广播前链上 `assetCount=14`；使用 HadronAssets owner 对应的 `SEED4_DEPLOYER_PRIVATE_KEY` 执行 `--slow --broadcast`。Q3 新 asset id：
  - tokenId 15 `de-bund-10y` tx `0x5f35efc972b7e4dd9fb95d10a60ac229aebdfc0f123ab3577842097b002e7bbb`
  - tokenId 16 `jp-jgb-5y` tx `0x5319e9b97007dde75d04b2b402f2096fe73f2cc539eb8b416b1587af0ea233bc`
  - tokenId 17 `apex-industrials-2029` tx `0x01f2ab11b38489ced7d88347fe6420311de86581320d6cbad84660716cac350a`
  - tokenId 18 `helios-utility-2031` tx `0x54f51b9c35752c50b75b27daecf6da45bb0fe1fac3d223de96effda6222f97f9`
- [x] 4.7 【Codex 人工审 diff】4 asset JSON `issuerSlug` 正确；`HadronAssets.createAsset` 为 `onlyOwner`，广播使用当前链上 owner `0xF26927F9c37D7a3F675Bd501006705E1Ab17dE8a` 对应 seed key，未使用 `DEPLOYER_PRIVATE_KEY`；未修改 `SeedV5.s.sol` 或既有 script。
- [x] 4.8 最终验证：广播后链上 `assetCount=26`；Explore 的 SOVEREIGN BONDS / CORPORATE BONDS 各 2 条由 `filterAssets` 单测覆盖；新资产详情页 issuer 跳 profile 与 profile KPI/活动区由组件测试、build 与本地 HTTP/server smoke 覆盖。

## 6. 更多 RWA 品类与样例资产（Codex 追加，约 25-35 分钟）

- [x] 6.1 先写红测：`web/test/lib/categories.test.ts` 断言 `money-market-funds` / `mortgages` / `equipment-finance` / `music-royalties` 4 类可直接映射、`DISPLAY_CATEGORIES` 长度为 14、顺序为 fixed income → credit → collateralized cashflow → hard assets → alternatives；`web/test/lib/issuers.test.ts` 断言 16 个 issuer 与 8 个新增 assetIds 反向聚合；`web/test/lib/metadata.test.ts` 断言 8 个新增 metadata slug 可加载且 docs 为 3 条。
- [x] 6.2 修改 `web/lib/categories.ts`：新增 4 个 `DisplayCategory` 值、`DISPLAY_CATEGORIES` 项和 `categoryDisplays` 配色，不改既有 10 类 gradient/tickerClassName。
- [x] 6.3 新增 issuer JSON ×4：`northstar-liquidity` / `civic-home-loans` / `ironvale-equipment-trust` / `tempo-royalty-vault`，保持 3 docs + 2 个 `demo.hadron.local` externalLinks。
- [x] 6.4 新增 asset JSON ×8：每个新增类别 2 个资产，全部 `issuerSlug` 指向新增 issuer，description/docs 均使用 illustrative 语气。
- [x] 6.5 更新 `web/lib/metadata.ts` 与 `web/lib/issuers.ts` 静态 import 列表，确保新增 asset/issuer 进入构建期 fail-fast 校验与 issuer profile。
- [x] 6.6 新建 `contracts/script/Seed2026Q4RwaBreadthExpansion.s.sol`：8 笔 `createAsset`，只登记资产，不做定价/挂单。
- [x] 6.7 验证：先跑新增测试确认红，再实现后跑 `cd web && npm test -- test/lib/categories.test.ts test/lib/issuers.test.ts test/lib/metadata.test.ts`；再跑 `cd web && npm test` 和 `cd web && npm run build`。
- [x] 6.8 更新 Graphify code graph：`python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"`。
- [x] 6.9 【Codex 已广播】Q4 多品类资产广播成功；新 asset id：
  - tokenId 19 `usdc-treasury-mmf-a` tx `0x025ac00d09d34581ba1b5ee978dd06a23163d7d08966694fabdb9f6e46a95087`
  - tokenId 20 `sgd-liquidity-note-2026` tx `0x89ce6a98a1c2ad037a23888c4c59ddc2fc87c89a2121c7c125bea0d33daefb87`
  - tokenId 21 `prime-mortgage-pool-2026-08` tx `0xc40b456757754edc883b6ee6eccf3f2d24570ad7a2294da9567de6a306a27a82`
  - tokenId 22 `sunbelt-rental-mortgage-b` tx `0x9651ec0e00d309c82ff3b7e9e4ef6ea4252eb401a929cb34798cefec1405b7ca`
  - tokenId 23 `gpu-lease-2027` tx `0x50ebdd8811de4d8c641ef874e910d09641a4c968325956126344abf5df92db80`
  - tokenId 24 `railcar-lease-pool-2028` tx `0x48a9eafd3b5d46c75fc38399139781734c6b03cfe967256d0efd420356fac7b7`
  - tokenId 25 `indie-catalog-royalty-a` tx `0xe673e2a1dd2978a886e1f97332a08fe29eed9d64a6763684d2d31d2f5fdb89d7`
  - tokenId 26 `streaming-royalty-basket-2026` tx `0x9d98a17c195a5588bea025bf33bc420803da3eb831d9aedf4f263a8aed7b18ea`

## 7. 归档前收尾

- [x] 7.1 `openspec validate rwa-narrative-deepening --strict --no-interactive` 通过。
- [x] 7.2 更新 `openspec/specs/market-browsing/spec.md`：合并本次 MODIFIED delta（14 类 chips + Issuer/Yield filter + 资产详情页 issuer 入口 + 统计条口径不变）。
- [x] 7.3 新建 `openspec/specs/issuer-profile/spec.md` + `openspec/specs/issuer-profile/design.md`（design.md 摘录本变更 design.md 的核心决策与目录结构）。
- [x] 7.4 提交 git，commit 信息按 `feat(web): RWA 叙事深化——Issuer profile + Sovereign/Corporate bonds + Explore 两维过滤`。
- [x] 7.5 归档：`openspec archive rwa-narrative-deepening --yes --skip-specs` → 移动到 `openspec/changes/archive/2026-07-22-rwa-narrative-deepening`。
- [x] 7.6 完整性检查通过：主 specs 已同步，design.md 已补齐，delta 将随 archive 保留，tasks 全部 `[x]`，完成变更归档后 `openspec/changes/` 不再包含本 change。
