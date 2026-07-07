## ADDED Requirements

### Requirement: 开发者 API 文档入口
系统 SHALL 提供一个轻量开发者 API 文档页，面向第三方说明 HADRON 的 REST/API 接入方式。页面 MUST 明确 API Key 由 HADRON 团队主动发放，MUST NOT 呈现公开申请表或申请流程。页面 SHALL 覆盖认证头、资产/挂单/买单/成交查询示例，以及下单类接口与链上签名交易之间的边界说明。页面还 SHALL 展示一组适度具体的交易 API，包括挂卖、挂买、买入挂单、成交买单、撤单、已签名交易广播与交易状态查询；这些端点 MUST 被描述为 API Key 保护的签名交易/广播辅助边界，MUST NOT 暗示 HADRON 托管用户私钥或可绕过钱包授权代客下单。

#### Scenario: 顶部导航进入 API 文档
- **WHEN** 用户查看顶部导航
- **THEN** 导航中存在 `API` 链接并跳转到开发者 API 文档页

#### Scenario: 密钥发放边界说明
- **WHEN** 用户打开开发者 API 文档页
- **THEN** 页面说明 API Key 由 HADRON 团队主动发放，且不提供公开申请流程

#### Scenario: 轻量 REST 说明
- **WHEN** 第三方阅读开发者 API 文档页
- **THEN** 页面展示用于查询资产、挂单、买单、成交的 REST 示例，并说明买卖挂单类操作仍需要调用方持有钱包签名授权或提交已签名链上交易

#### Scenario: 交易端点说明
- **WHEN** 第三方阅读开发者 API 文档页
- **THEN** 页面展示挂卖、挂买、买入挂单、成交买单、撤单、已签名交易广播与交易状态查询端点，并列出关键请求字段、响应字段和常见错误码

### Requirement: 只读查询 API
系统 SHALL 开放只读查询 API：`GET /v1/assets`、`GET /v1/orders/listings`、`GET /v1/orders/bids`、`GET /v1/trades`。这些接口 MUST 返回 JSON，所有链上整数 MUST 以十进制字符串输出，且 MUST 复用前端现有资产、挂单、买单与事件解析口径。查询 API MAY 支持 `tokenId`、地址、`limit`、事件类型等基础过滤参数；非法参数 MUST 返回 400 JSON 错误。

#### Scenario: 查询资产
- **WHEN** 第三方调用 `GET /v1/assets`
- **THEN** 系统返回资产目录、静态披露元数据与当前一级发行状态，bigint 字段以字符串表示

#### Scenario: 查询挂单和买单
- **WHEN** 第三方调用 `GET /v1/orders/listings?tokenId=1` 或 `GET /v1/orders/bids?tokenId=1`
- **THEN** 系统返回对应 token 的活跃卖单或买单列表，并沿用现有价格排序口径

#### Scenario: 查询成交事件
- **WHEN** 第三方调用 `GET /v1/trades?tokenId=1&limit=25`
- **THEN** 系统返回最近成交/市场事件，包含 `txHash`、`blockNumber`、`logIndex`、`type` 与相关金额字段

### Requirement: API Key 交易辅助 API
系统 SHALL 开放 API Key 保护的轻量交易辅助 API：`POST /v1/orders/listings/prepare`、`POST /v1/orders/bids/prepare`、`POST /v1/orders/listings/{listingId}/buy/prepare`、`POST /v1/orders/bids/{bidId}/fill/prepare`、`POST /v1/orders/cancel/prepare`、`POST /v1/trades/broadcast`、`GET /v1/transactions/{txHash}`。这些接口 MUST 要求 `Authorization: Bearer <key>`，key MUST 来自 HADRON 团队主动发放并通过服务端环境变量配置。系统 MUST NOT 提供公开申请、创建、轮换或管理 API Key 的用户界面。交易 prepare 接口 MUST 只返回合约地址、chainId、函数名、参数、calldata 与 value，不得服务端签名。广播接口 MUST 只接收调用方已签名的 raw transaction 并提交到 Arc RPC。

#### Scenario: API Key 鉴权
- **WHEN** 第三方调用任一交易辅助 API 且未提供有效 `Authorization: Bearer` key
- **THEN** 系统返回 401 JSON 错误，错误码为 `INVALID_API_KEY`

#### Scenario: 准备交易 calldata
- **WHEN** 第三方使用有效 API Key 调用挂卖、挂买、买入挂单、成交买单或撤单 prepare 接口
- **THEN** 系统返回对应 HadronMarket 合约函数的 calldata、十进制字符串参数、`to`、`chainId` 与 `value`

#### Scenario: 广播已签名交易
- **WHEN** 第三方使用有效 API Key 调用 `POST /v1/trades/broadcast` 并提交 `signedTx`
- **THEN** 系统通过 Arc RPC 广播 raw transaction，并返回 `txHash`、`status` 与 explorer 链接

#### Scenario: 查询交易状态
- **WHEN** 第三方使用有效 API Key 调用 `GET /v1/transactions/{txHash}`
- **THEN** 系统返回 pending、success 或 reverted 状态，以及可用的 receipt 字段
