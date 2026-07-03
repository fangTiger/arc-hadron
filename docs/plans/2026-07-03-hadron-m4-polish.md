# HADRON M4 — 视觉与数据打磨 实现计划

> **For agentic workers:** 由 Claude（总架构师）经 `codex exec` CLI + Bash 后台逐 Task 调度（不要用 codex MCP 同步调用）。每 Task 后 Claude 审查 diff + 运行验证 + 提交。
> 对应 OpenSpec tasks.md 第 4 组。范围决策（2026-07-03 用户确认）：M5 的 Vercel 部署**排除**；README 保留；后续新方向（AI 层 DeepSeek / 买单深度 / 收益分配）在 M4/M5 收尾后另立提案，全部要做。
> 前置事实：4.1 链上动态流已在 M2R/M3R 提前完成（分块扫描/去重/localStorage 缓存/ACTIVITY 面板/explorer 链接），本计划不再包含。

**Goal:** 详情页专业级走势图（lightweight-charts）+ 全站微动效终审 + 更丰富的种子成交数据 + README 品牌叙事。

**约束不变量:** UI 文案英文、注释中文、bigint 全链路、SHARE_SCALE=100（每份价格显示 = 链上单位价 ×100）、FIRST_ACTIVE_TOKEN_ID=15、TDD、每 Task 全量回归（vitest + lint + build）。

## Task P1: lightweight-charts 走势图（codex）
- `npm i lightweight-charts`（Claude 预装，codex 无网）；
- web/components/asset/PriceChart.tsx 重写：lightweight-charts AreaSeries（价格序列来自现有 lib/marketMetrics priceSeriesForAsset，已含 ×100 份额价换算），发行价基线（PriceLine 虚线），无成交时用发行价单点兜底；深色主题对齐 A+ token（bg/panel/border/neon 变量），十字光标 + 时间轴；SSR 安全（dynamic import / useEffect 挂载，组件卸载 remove()）；
- 市场表行内迷你走势线保留现有轻量 SVG 实现（不动）；
- 测试：图表数据变换纯函数（series → lightweight-charts 数据格式、基线取值、空态兜底）单测；组件层挂载逻辑以 mock 库句柄测 create/update/destroy 生命周期；
- 验证：test/lint/build + /asset/15 页面 200。

## Task P2: 微动效系统与 A+ 视觉终审（codex）
- 盘点现状：AnimatedNumber（数字滚动）已有；补齐：骨架屏 shimmer 微光（现 Skeleton 是否有动画，无则加）、表行/卡片 hover 光晕过渡统一（border-glow token）、页面切换淡入（app/template.tsx 或 CSS）、toast 进出场动效；
- prefers-reduced-motion 降级（媒体查询关闭动效）；
- 全站视觉终审清单跑一遍：间距/对齐/字号层级/空态/加载态一致性，发现的问题直接修；
- 验证：test/lint/build + 三页 200。

## Task P3: 种子成交丰富化（codex 写脚本改造 + Claude 上链）
- 现状：新资产仅 4 个有一级成交、6 个有二级挂单/3 笔自成交；deployer 余额 ~130e18，SeedTrades 有 MIN_DEPLOYER_RESERVE=80e18 保留线；
- SeedTrades 降低目标单笔金额档（新增 5~15e18 小额档位并多轮次），在保留线内覆盖更多资产（目标 ≥10 个资产有一级成交）；SeedSecondary 提高覆盖资产数（MAX_TARGET_ASSETS 6→10，档位间隔加大 0.94~1.08 制造更明显波动）；
- Claude 上链执行（SEED_MIN_OFFERING_ID=15）+ cast 核对；前端确认多数资产 24H/走势非零。

## Task P4: README 品牌叙事（codex，不部署）
- 根 README.md（英文）：产品定位（Arc 上的 RWA 交易所）、架构图（contracts/web/事件层）、合约地址与 explorer 可查证清单（引用 deployments/arc-testnet.json）、本地运行步骤、测试证据汇总（forge/vitest 数量）；截图占位。

## Task P5: 收尾（Claude 主导）
- 用户完成 3.3 二级验收（挂单/撤单/二级购买）→ 勾选 3.3；
- verification-before-completion：M1-M4 验收标准逐条取证清单；
- M5.1（3D 首屏）默认跳过（性能与 A+ 审美风险 > 收益，用户未主动要求）；如用户要求再立项；
- 归档 add-hadron-rwa-exchange：delta specs 合并 specs/、design.md 同步、6 项完整性检查（Vercel 部署项在 proposal 中标注范围变更为排除）。

## 执行顺序
P1 → P2（同域 web/ 串行）；P3 与 P1/P2 并行（contracts 域）；P4 随后；P5 等用户验收。
