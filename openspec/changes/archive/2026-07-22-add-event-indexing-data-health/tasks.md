## 1. 测试先行

- [x] 1.1 新增 `web/test/event-index.test.ts`：覆盖首次索引、增量索引、`chainId:txHash:logIndex` 去重、增量失败保留缓存与 `lastError`。
- [x] 1.2 新增/扩展 public query 测试：断言 `loadTradesPayload` 使用 indexed events 后仍保留 tokenId/type/limit 过滤与序列化 schema。
- [x] 1.3 新增 `web/test/status-route.test.ts` 或服务测试：断言 `/v1/status` 返回 chainId/latestBlock/indexedBlock/lagBlocks/cachedEvents/lastIndexedAt/lastError。

## 2. 核心实现

- [x] 2.1 新建 `web/lib/eventIndex.ts`：实现进程内缓存、游标、去重 key、状态快照与测试可重置 helper。
- [x] 2.2 将 `web/lib/api/publicQuery.ts` 的 trades 事件来源切到 `loadIndexedMarketEvents`，保留现有排序、过滤、limit 与 serializer。
- [x] 2.3 新建 `web/app/v1/status/route.ts`：调用 index status helper，返回只读 JSON；失败时用 500 + 可读错误结构。
- [x] 2.4 确认没有新增 npm 依赖，没有改变交易 prepare/broadcast 或合约写路径。

## 3. 验证

- [x] 3.1 RED：运行新增/相关测试，确认因 event index/status 未实现而失败。
- [x] 3.2 GREEN：实现后运行 `cd web && npm test -- test/event-index.test.ts test/public-query-service.test.ts`。
- [x] 3.3 全量验证：运行 `cd web && npm test` 与 `cd web && npm run build`。
- [x] 3.4 OpenSpec 验证：`openspec validate add-event-indexing-data-health --strict --no-interactive`。
- [x] 3.5 更新 Graphify code graph。
