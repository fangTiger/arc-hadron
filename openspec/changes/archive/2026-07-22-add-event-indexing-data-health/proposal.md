## Why

`/v1/trades` 和部分前端事件消费路径会从部署块到最新块重复扫描日志；Arc RPC 对大范围日志读取偶发失败时，用户只能看到空结果或泛化错误，无法判断数据新鲜度。现在资产目录继续扩容，事件读取必须先具备增量索引和健康可观测能力。

## What Changes

- 新增服务端事件索引 helper：按 `chainId + txHash + logIndex` 去重，记录已索引区块游标，并在同一进程内复用暖缓存。
- 修改 `/v1/trades` 的读取路径：优先使用索引 helper 的增量结果，保留现有序列化与过滤行为。
- 新增公共只读 `/v1/status` endpoint：返回 chainId、latestBlock、indexedBlock、lagBlocks、cachedEvents、lastIndexedAt、lastError。
- 错误处理改为可诊断：增量扫描失败时保留已有缓存与明确 `lastError`，不清空已索引事件。
- 不引入数据库、不改变钱包签名/广播/合约写路径；持久化 worker 和外部存储留作后续版本。

## Capabilities

### New Capabilities

- `event-indexing`: 服务端事件日志增量索引、去重、游标和健康状态。

### Modified Capabilities

- `web-data-freshness`: 增加公共数据健康端点与事件读取滞后度要求。

## Impact

- Affected code:
  - `web/lib/eventIndex.ts`（新增）
  - `web/lib/api/publicQuery.ts`
  - `web/app/v1/status/route.ts`（新增）
  - `web/test/event-index.test.ts`（新增）
  - `web/test/public-query-service.test.ts` 或 API route 相关测试
- Affected APIs:
  - 新增 `GET /v1/status`
  - `GET /v1/trades` 响应 schema 不变
- Dependencies:
  - 无新增 npm 依赖
- Operational notes:
  - v1 为进程内暖缓存，适合降低热路径重复扫描；多实例/冷启动仍可能回退到首次全量扫描。
