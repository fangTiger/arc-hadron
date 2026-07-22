## ADDED Requirements

### Requirement: 公共数据健康端点

系统 SHALL 提供 `GET /v1/status` 只读端点，用于返回事件索引与链上数据新鲜度。响应 MUST 至少包含：`chainId`、`latestBlock`、`indexedBlock`、`lagBlocks`、`cachedEvents`、`lastIndexedAt`、`lastError`。

#### Scenario: 返回索引健康状态
- **WHEN** 客户端调用 `GET /v1/status`
- **THEN** 响应包含当前 chainId、latest block、已索引 block、落后区块数、缓存事件数、最近索引时间与最近错误

#### Scenario: 无错误状态
- **WHEN** 最近一次索引成功且没有错误
- **THEN** `lastError` 为 `null`，`lagBlocks` 等于 `latestBlock - indexedBlock`

#### Scenario: RPC 错误可见
- **WHEN** 最近一次增量索引失败
- **THEN** `lastError` 返回可读错误消息，且 `indexedBlock` 不超过最后成功扫描的区块
