# Design: Event indexing

## Context

`/v1/trades` 和服务端只读路径如果每次都从 `DEPLOY_BLOCK` 扫到 latest，会放大 Arc RPC 压力；当 RPC 限流或区块范围失败时，也缺少清晰的新鲜度状态。

## Decisions

| # | 决策 | 选择 |
|---|------|------|
| 1 | 存储层 | 同一 Node 进程内的 module cache |
| 2 | 游标 | `indexedBlock` 记录最后成功扫描区块 |
| 3 | 去重键 | `${chainId}:${txHash}:${logIndex}` |
| 4 | 失败策略 | 保留旧缓存与旧游标，记录 `lastError` |
| 5 | API 接入 | `/v1/trades` 复用索引事件，schema 与过滤保持兼容 |
| 6 | 可观测性 | `/v1/status` 暴露 latest/indexed/lag/cache/error |

## Trade-offs

- 进程内缓存简单、无新增依赖，但 serverless 多实例/冷启动不共享；持久化 indexer 留作后续版本。
- 当前策略不处理深度链重组；测试网 v1 优先降低重复扫描和提高错误可诊断性。
- 失败时不推进游标，避免把未成功扫描的区间标记为完成。
