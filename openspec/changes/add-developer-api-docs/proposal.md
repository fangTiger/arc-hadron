# Change: 轻量开发者 API 文档页

## Why

HADRON 需要一个轻量入口说明第三方如何通过 API/REST 方式理解挂单、买卖与查询能力。当前顶部导航没有开发者入口，也没有说明 API Key 由团队主动发放而非开放申请。

## What Changes

- 新增开发者 API 文档页，说明 API Key 由 HADRON 团队主动发放，不提供公开申请流程。
- 文档页覆盖轻量 REST 接口视角：认证头、查询资产/挂单/买单/成交、下单类调用的链上签名边界。
- 开放只读查询 API：`GET /v1/assets`、`GET /v1/orders/listings`、`GET /v1/orders/bids`、`GET /v1/trades`。
- 交易写接口只保留草案说明，本阶段不开放 POST 下单、挂单、撤单或广播接口。
- 首页顶部导航新增 `API` 链接，跳转到开发者 API 文档页。

## Impact

- Affected specs: `developer-api`
- Affected code:
  - `web/components/layout/TopBar.tsx`
  - `web/app/developers/api/page.tsx`
  - `web/app/v1/**/route.ts`
  - `web/lib/api/publicQuery.ts`
  - 相关前端测试
- Non-impact:
  - 不新增 API Key 申请流程
  - 不新增密钥数据库、后台管理或托管 signer
  - 不改变现有合约、钱包签名交易流或链上读取 hook
  - 不开放交易写入 API
