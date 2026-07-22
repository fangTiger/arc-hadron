## Context

HADRON 的只读市场数据主要来自合约 read 与事件日志扫描。当前 `/v1/trades` 每次请求都会从 `DEPLOY_BLOCK` 扫到 latest；浏览器侧 `useMarketEvents` 有增量缓存，但公共 API 与服务端读取仍缺少共享索引状态。Arc RPC 偶发 log range 错误时，系统也缺少一个能告诉用户“数据扫到哪里、落后多少块、最后一次错误是什么”的健康端点。

## Goals / Non-Goals

**Goals:**

- 为市场事件提供服务端进程内暖缓存，支持首次全量扫描后按 `indexedBlock + 1` 增量拉取。
- 用 `chainId + txHash + logIndex` 去重，避免重复 chunk 或重复请求造成重复成交。
- 让 `/v1/trades` 复用索引结果，但保持现有过滤、limit、序列化 schema 不变。
- 新增 `/v1/status` 返回 latest/indexed/lag/error/cache size，帮助定位 RPC 或索引滞后问题。
- 保留现有 RPC fallback 能力；扫描失败时不清空已缓存事件。

**Non-Goals:**

- 不引入数据库、队列、cron worker 或外部托管服务。
- 不改变合约、钱包签名、交易 prepare/broadcast 路径。
- 不替换浏览器 `useMarketEvents` 的本地增量缓存。
- 不承诺跨 Vercel serverless 冷启动或多实例共享索引状态。

## Decisions

| # | 决策 | 选择 | 原因 |
|---|------|------|------|
| 1 | 存储层 | 进程内 module cache | 无新增依赖，今晚可安全上线；冷启动回退到首次扫描 |
| 2 | 游标 | `indexedBlock` 记录已完成扫描的最高块 | 简单、可测试，失败时不推进游标 |
| 3 | 去重 key | `${chainId}:${txHash}:${logIndex}` | 同一 tx 内 logIndex 唯一，chainId 防未来多链冲突 |
| 4 | 错误策略 | 保留缓存 + 记录 `lastError` | 避免 RPC 临时错误导致 API 返回从“有数据”退化为空 |
| 5 | API 接入 | `/v1/trades` 读取 indexed events，响应 schema 不变 | 降低重复扫描风险，不破坏集成方 |
| 6 | 健康端点 | `GET /v1/status` | 用户和开发者可直接判断 data freshness |

## Risks / Trade-offs

- **Serverless 多实例缓存不共享** → v1 明确标注为暖缓存；后续升级到持久化 indexer/DB。
- **首次请求仍可能全量扫描** → `/v1/status` 暴露 lag 与错误；后续可加 cron warmup。
- **重组处理有限** → v1 默认测试网轻量策略；后续增加确认深度与回滚窗口。
- **内存随事件增长** → 当前测试网事件量可控；状态端点暴露 `cachedEvents` 便于观察。

## Migration Plan

1. 新增 `web/lib/eventIndex.ts` 与单元测试。
2. 将 `/v1/trades` 的事件来源切到 index helper，保留 filter/sort/serialize。
3. 新增 `/v1/status` route 与 route/service 测试。
4. 跑 `npm test`、`npm run build`、`openspec validate`。
5. 若线上有异常，可回滚到原 `/v1/trades` 直接扫描路径；合约和写路径不受影响。

## Open Questions

- 后续持久化存储使用 Vercel Postgres、KV、外部 worker，还是自托管 indexer，需要单独决策。
- 是否为 Arc testnet 引入确认深度（例如 latest - 3）与短窗口重扫，留到持久化版本设计。
