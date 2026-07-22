# event-indexing Specification

## Purpose

定义 Hadron Web 服务端事件日志的进程内增量索引、去重、失败保留与健康状态能力，降低公共 API 对 Arc RPC 的重复全量扫描压力。

## Requirements

### Requirement: 服务端事件索引缓存

系统 SHALL 提供服务端事件索引 helper，按 `DEPLOY_BLOCK` 到 latest 的范围读取市场相关日志，并在同一进程内缓存已解析事件。首次读取 SHALL 建立缓存；后续读取 SHALL 从 `indexedBlock + 1` 增量扫描到 latest。

#### Scenario: 首次索引
- **WHEN** 缓存为空且 latest block 大于等于 `DEPLOY_BLOCK`
- **THEN** 系统从 `DEPLOY_BLOCK` 扫描到 latest，解析并缓存事件，且 `indexedBlock` 等于 latest

#### Scenario: 增量索引
- **WHEN** 缓存已有事件且 `indexedBlock = 100`
- **THEN** 下一次 latest 为 `105` 时，系统只请求 `101..105` 的日志范围

### Requirement: 事件去重

系统 MUST 使用 `chainId + txHash + logIndex` 作为事件唯一键。重复日志或重复扫描同一范围时，缓存中 MUST 只保留一条事件。

#### Scenario: 重复日志返回
- **WHEN** RPC 返回两条相同 `txHash` 与 `logIndex` 的日志
- **THEN** 索引缓存只保留一条对应事件

### Requirement: 索引失败保留缓存

系统 MUST 在增量扫描失败时保留已缓存事件、保留原 `indexedBlock`，并记录 `lastError`。失败 MUST 不清空缓存，也 MUST 不把游标推进到未成功扫描的块。

#### Scenario: 增量扫描失败
- **WHEN** 缓存已索引到 block 100，而扫描 `101..105` 抛错
- **THEN** `indexedBlock` 仍为 100，已缓存事件仍可返回，`lastError` 包含失败消息

### Requirement: 交易 API 使用索引结果

`GET /v1/trades` 的服务层 SHALL 使用事件索引 helper 提供的事件集合，并保持现有 `tokenId`、`type`、`limit` 过滤与响应 schema 不变。

#### Scenario: Trades 查询保持兼容
- **WHEN** 调用 `/v1/trades?tokenId=2&type=purchased&limit=5`
- **THEN** 响应字段与现有 trades payload 一致，结果只包含 tokenId 2 的 purchased 事件且最多 5 条
