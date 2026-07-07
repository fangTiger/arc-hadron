# Tasks: 轻量开发者 API 文档页

## 1. 规格

- [x] 1.1 创建 OpenSpec proposal、spec delta、tasks。
- [x] 1.2 验证 OpenSpec 变更格式。

## 2. 前端文档页

- [x] 2.1 先写失败测试：顶部导航展示 `API` 链接并指向开发者 API 文档页。
- [x] 2.2 先写失败测试：开发者 API 文档页说明密钥由团队主动发放、无申请流程，并展示 REST 查询/交易边界。
- [x] 2.3 实现 `/developers/api` 页面，保持交易所工具型视觉风格，不做营销式落地页。
- [x] 2.4 在顶部导航加入 `API` 链接。

## 3. 验证

- [x] 3.1 运行相关 Vitest 测试。
- [x] 3.2 运行 lint 或全量前端测试。
- [x] 3.3 更新 graphify 代码图谱。

## 4. 交易 API 文档增强

- [x] 4.1 先写失败测试：文档页展示具体交易端点、请求/响应字段与错误码。
- [x] 4.2 实现交易 API 文档增强：挂卖、挂买、买入、成交买单、撤单、交易状态查询。
- [x] 4.3 重新运行相关测试、OpenSpec 校验、lint/全量测试并更新 graphify。

## 5. 只读查询 API 实现

- [x] 5.1 先写失败测试：`/v1/assets`、`/v1/orders/listings`、`/v1/orders/bids`、`/v1/trades` GET 路由返回 JSON 查询数据。
- [x] 5.2 先写失败测试：查询 API 支持基础过滤参数并拒绝无效参数。
- [x] 5.3 实现服务端只读链上查询层，复用现有资产、挂单、买单、事件映射口径。
- [x] 5.4 实现四个只读 Next.js route handlers；交易路由留待后续任务实现。
- [x] 5.5 更新开发者文档，说明只读查询 API 已开放并标注交易边界。
- [x] 5.6 运行相关测试、OpenSpec 校验、lint/全量测试并更新 graphify。

## 6. API Key 交易辅助 API

- [x] 6.1 先写失败测试：团队主动发放的 API Key 鉴权接受有效 Bearer key，拒绝缺失或错误 key。
- [x] 6.2 先写失败测试：交易 prepare 服务生成 HadronMarket calldata、value 与十进制字符串参数。
- [x] 6.3 先写失败测试：交易 route handlers 对 prepare、broadcast、transaction status 进行 API Key 保护并返回 JSON。
- [x] 6.4 实现 API Key 鉴权 helper，使用 `HADRON_API_KEYS` 环境变量配置主动发放的 key。
- [x] 6.5 实现交易 prepare、signedTx broadcast 与交易状态查询服务。
- [x] 6.6 实现交易 API route handlers，保持服务端不签名、不托管私钥。
- [x] 6.7 更新开发者文档，说明交易 API 已作为 API Key 保护的签名交易辅助接口开放。
- [x] 6.8 运行相关测试、OpenSpec 校验、lint/全量测试、build 并更新 graphify。
