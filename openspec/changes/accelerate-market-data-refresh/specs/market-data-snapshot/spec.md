## ADDED Requirements

### Requirement: 公共资产服务端快照
`GET /v1/assets` SHALL 在单个服务实例内复用最近一次成功的资产 payload，快照新鲜期 MUST 为 `15_000ms`。同一时刻发生的多个冷请求 MUST 共享同一个 in-flight 加载过程；失败的加载 MUST NOT 覆盖最近一次成功快照。端点响应 JSON 结构 SHALL 与变更前保持兼容。

#### Scenario: 新鲜快照直接复用
- **GIVEN** 服务端在 15 秒内成功生成过资产快照
- **WHEN** 再次调用 `GET /v1/assets`
- **THEN** 返回同一份成功 payload，且不新增链上资产读取

#### Scenario: 并发冷请求合并
- **GIVEN** 服务端没有新鲜快照
- **WHEN** 多个请求在首次加载完成前同时调用 `GET /v1/assets`
- **THEN** 所有请求共享一次链上加载并获得相同结果

#### Scenario: 失败不污染缓存
- **GIVEN** 服务端已有最近一次成功快照但其 TTL 已过期
- **WHEN** 后台重新加载失败
- **THEN** 失败结果不覆盖最近一次成功快照，后续请求仍可重新尝试加载

### Requirement: 资产链上读取并行化
服务端资产 payload 加载 SHALL 分为至多两轮有依赖的 RPC：第一轮并行读取 `assetCount` 与 `offeringCount`；第二轮并行读取资产 multicall 与发行 multicall。最终映射、容错和静态元数据补全口径 MUST 保持不变。

#### Scenario: 数量读取并行
- **WHEN** 服务端开始冷加载资产 payload
- **THEN** `assetCount` 与 `offeringCount` 在等待任一结果前均已发起

#### Scenario: 明细读取并行
- **GIVEN** 两个数量读取均已完成
- **WHEN** 服务端加载资产和发行明细
- **THEN** 资产 multicall 与发行 multicall 在等待任一结果前均已发起

### Requirement: 首页持久化 SWR
市场首页 SHALL 使用稳定 query key 从 `GET /v1/assets` 读取资产快照，并将最后一次成功结果以版本化 key 持久化到浏览器本地存储。页面刷新时 MUST 先恢复可校验的 last-good 快照并立即渲染，同时在后台重新验证；后台重新验证期间 MUST 保留已有数据。

#### Scenario: 硬刷新立即恢复
- **GIVEN** 浏览器本地存储中存在格式有效的最后成功快照
- **WHEN** 用户硬刷新市场首页
- **THEN** 首页在网络请求完成前显示该资产目录，且后台发起重新验证

#### Scenario: 后台刷新不回退骨架
- **GIVEN** 首页已经显示一份资产快照
- **WHEN** 快照进入重新验证状态
- **THEN** 资产表保持上一份数据，不重新显示整表骨架

#### Scenario: 成功结果持久化
- **WHEN** `GET /v1/assets` 返回并解析为有效资产 payload
- **THEN** 客户端更新 React Query 数据并覆盖本地 last-good 快照

#### Scenario: 无快照时失败
- **GIVEN** 内存和本地存储都没有有效快照
- **WHEN** 首次请求失败
- **THEN** 首页显示可读错误状态且不展示伪造资产数据

#### Scenario: 无效本地数据降级
- **GIVEN** 本地存储中的 schema 版本或字段格式无效
- **WHEN** 首页尝试恢复快照
- **THEN** 客户端忽略该值并按普通首次请求加载，不导致页面崩溃
