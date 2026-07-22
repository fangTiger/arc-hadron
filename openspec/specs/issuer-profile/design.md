# Design: Issuer profile

## Context

Hadron 的资产目录已从少量示例资产扩展到多品类 RWA。单个资产卡片无法表达发行人背景、跨资产族聚合和 issuer 级活动，因此需要一个结构化 issuer 层。

## Decisions

| # | 决策 | 选择 |
|---|------|------|
| 1 | 数据层 | `web/content/issuers/*.json`，构建期静态 import |
| 2 | 资产关联 | asset JSON 使用 `issuerSlug` 指向 issuer；`assetIds` 由 loader 反向聚合 |
| 3 | 页面路由 | `/issuers/[slug]` 静态生成，未知 slug `notFound()` |
| 4 | KPI 来源 | 静态资产元数据 + 现有 activity/event 数据派生，不新增服务端聚合 |
| 5 | 活动流 | 复用 activity-feed hook 后按 `issuer.assetIds` 前端过滤 |
| 6 | 文档与链接 | 全部为 illustrative stub，外链仅允许 `demo.hadron.local` |

## Structure

- `web/lib/issuers.ts`：issuer schema、校验、静态索引、KPI helper。
- `web/content/issuers/*.json`：issuer 元数据。
- `web/app/issuers/[slug]/page.tsx`：issuer profile 路由。
- `web/components/issuer/*`：Header、KPI、Assets table、Docs、External links、Recent activity。
- `web/components/market/SortableAssetsTable.tsx`：市场页与 issuer profile 共用的资产表格。

## Trade-offs

- Issuer 先保持 off-chain JSON，避免改合约；构建期 fail-fast 降低引用漂移风险。
- Cumulative Volume 依赖事件扫描，首屏可显示 skeleton；其余 KPI 可立即由静态资产数据计算。
- 不引入真实 issuer 域名或法律文件，保持演示环境语气和占位域名边界。
