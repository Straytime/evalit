# 技术决策与外部验证记录

版本 techv_0.2；2026-09-20。依据：[技术设计](evalit_v001_technical_design.md)、PRD docv_0.3、Git a58d008、用户关于严格 TDD 和 Langfuse SaaS 的补充；修订见[独立评审记录](../changes/CHG-20260920-003.md)。状态“选定”表示技术设计采用，不表示已实现或实测通过。

| ID | 决策 | 状态 |
| --- | --- | --- |
| ADR-001 | 所有变更遵循技术设计→测试→实现 | 用户硬性要求 |
| ADR-002 | Electron / React / TypeScript 模块化桌面应用 | 选定 |
| ADR-003 | SQLite 单写者、不可变版本与独立 Run 快照 | 选定 |
| ADR-004 | QuickJS WASM + 独立进程执行 TS/JS 与 SSE 规则 | 选定；需攻击/打包测试 |
| ADR-005 | 关联 Trace 自身 Metadata，Cloud API 保持语义等价 | 用户已明确；读取兼容性待实测 |
| ADR-006 | 不自动重试，不在崩溃后续跑 | PRD 硬约束及技术补充 |
| ADR-007 | 技术默认值、CSV/Schema 与生命周期解释 | 选定；可按 TDD 后续调整 |
| ADR-008 | TDD gate 与远端保护先于产品实现 | 选定；当前尚未部署 |

## ADR-001：严格 TDD

本项目的测试是设计与实现之间的验收层。功能开发、修复、重构、测试本身、依赖、CI、原型和文档变更无豁免。纯重构通过 characterization + mutation 验证敏感性，不能以“旧行为本来通过”规避测试价值证明。具体标准见[TDD 规范](tdd_workflow.md)。

本次交付只实现文档级检查和规范入口，不把“产品测试规格”写成“产品测试通过”；场景数量由追踪矩阵与测试策略共同校验。

## ADR-002：桌面与语言

选择 Electron 以复用 HTML/CSS 原型、统一 TypeScript 契约并覆盖桌面自动化。备选 Tauri 体积较小，但首版引入 Rust 及桥接测试成本；纯浏览器无法直接满足本地凭证/文件/执行隔离；原生 SwiftUI 与现有原型的转换成本较高。接受 Electron 包体，限制 renderer 权限和主线程工作。

选择 Core utility process + 窄 IPC，避免 renderer 直接存储/调用服务；SQLite 单写者降低本地事务复杂度。平台最小版本和包版本在 M0 固定，不把当下未安装的库写成现有事实。

Main broker 统一创建/硬终止 Core、编译进程与 Sandbox，按 epoch/task/handle 管理所有权；退出确认先于名额释放和恢复写者。Core 不能调用 Main-only API，SIGTERM 不能冒充硬截止。

## ADR-003：数据与版本

SQLite 支持本地事务与可携带数据，不引入服务端数据库。对象版本最多 10 个，Run 快照独立持久化，因此淘汰对象版本不影响历史运行。CSV 保留原始值，不做隐式类型推断；Langfuse Dataset 只保留关联，运行时取最新时间点全量快照。

RemoteDataset 的 Cloud version 参数只为一致性读取服务，仍不进入 evalit 的版本/回滚功能。远端内容上报、权限、分页契约要真实验证，不能由演示原型推定。

各阶段独立 CAS；case/run 仅事务内聚合，不共用并发评估器的提交令牌。外部产出文件和目录持久化屏障先于 DB 引用提交，恢复验证完整性；不把 rename 或文件 flush 单独当作断电保证。

## ADR-004：不可信代码与 SSE 规则

JS/TS 和 LLM 生成的 SSE 解析脚本均视为不可信代码。选择无宿主桥接 QuickJS WASM，外围进程用于硬截止/清理。Node vm、直接 eval、iframe/Worker 仅改执行位置，不能满足 PRD 的文件/环境/网络/子进程禁止访问要求。

首版同步 evaluate/parse 函数返回 JSON，不提供 npm 包、系统 API、异步网络或动态 import。引擎限制与父进程硬截止同时生效；真实恶意输入测试和资源测量是发布要求。QuickJS 维护方明确未作安全审计，此选型不构成形式化安全证明。

TS 编译前端也纳入隔离：纯内存 CompilerHost、固定虚拟文件与内置 lib 白名单；无磁盘模块解析、自动类型发现、用户 tsconfig 或默认文件系统回退。不能等代码进 QuickJS 后才阻止文件访问。

<a id="adr-005"></a>
## ADR-005：Langfuse SaaS 与 metadata

用户已确认使用 Langfuse SaaS；PRD 的私有化部署假设不适用于当前交付。baseUrl 仍配置化，验收首先面向 Cloud，首版不承诺全部自部署版本兼容。

官方目前的读取路线是 Observations v2；TraceEnvelope 由同 traceId 的全部节点重建，保留数据来源和 schemaVersion。旧 Trace API 不能作为永久依赖。参考[官方迁移说明](https://langfuse.com/faq/all/deprecated-api-migration)。

2026-09-20 核查：官方公布旧 GET /traces 和 /traces/{traceId} 在 Cloud 的服务截止为 2026-11-16；官方 OpenAPI 还说明其他兼容读取路径可能延迟约 10 分钟，不能据此承诺响应后 60 秒成功。v2 的 trace_context 字段组列出 tags/release/traceName，单个 metadata 字段本身不构成 Trace 级来源证明。上述日期/能力在 M2/M4 实施和发布前重新核查，不将临时兼容路由当长期方案。[官方 OpenAPI](https://cloud.langfuse.com/generated/api/openapi.yml)

用户重申：关联对象就是 Langfuse Trace 自身的 Metadata。规则为 Agent 响应字段 A 的值 = Trace.metadata.B，去重得到 traceId 后读取整条 Trace；Observation 选择属于后续评估输入映射。此前建议用户选择“根/任意 Observation”偏离 PRD，已撤回；不新增根节点必须保存字段的要求。

新版物理存储与此业务语义分开处理。Langfuse 文档说明 Trace 级属性可传播到 Observation；OTEL 映射同时区分 langfuse.trace.metadata.<key> 与 langfuse.observation.metadata.<key>，不能把节点私有 metadata 当作 Trace 级关联条件。[数据模型](https://langfuse.com/docs/observability/data-model)、[metadata 映射](https://langfuse.com/integrations/native/opentelemetry/migration-to-v4)

适配器的合同是 findTraceIdsByTraceMetadata：优先保证 Trace 级语义，而非绑定某个 API 路径。已有 Trace API 在仍可用时可作为兼容路径；Observation API 必须证明 Trace metadata 的读取/来源等价后才启用该能力。测试须包含“只有节点私有 metadata 命中、Trace metadata 不命中”的反例；不能证明区分时返回 TRACE_METADATA_UNSUPPORTED，不能静默使用根节点替代。

读取命中项须按 traceId 去重，0 条继续轮询，多条 Trace 按 PRD 失败。物理返回多个属于同一 Trace 的 Observation 不等于命中多个 Trace。仍需真实 Cloud 契约验证，但不再有产品规则待用户选择。

Cloud 数据时效取决于上报方式。PRD 的 60 秒上限不变；如果 Agent 的实际数据延迟超出上限，显示失败，不假装“改读取重试策略”能保证成功。真实试运行验证是该集成的前提，不是要求用户现在提供账户 Secret。

## ADR-006：中断恢复

不支持重试/续跑，避免重复副作用和模型费用。本地事务与远端调用无法原子化，因此恢复保留已提交结果、终止未决阶段，不承诺外部 exactly-once。Run 状态完全沿用 PRD，工程中断用错误码表达，不新增一个混入统计的 cancelled 状态。

## ADR-007：技术默认值与产品解释

以下内容在 PRD 未细化，由本设计明确选择，实施时必须连同测试实现：

| 项 | 选择与原因 |
| --- | --- |
| 归档对象与已有计划 | 已有计划可继续运行；仅禁止新计划选择。归档计划自身不可运行 |
| 连接删除 | 有保留版本/活动运行引用时阻止；避免历史版本和现有计划失效 |
| 同时运行 | 全局一个 Run 活跃，其余 pending；用例内部并发可调 |
| 源 Dataset 顺序 | 本次固定版本 API 的返回次序；不谎称跨运行恒定次序 |
| Remote item ARCHIVED | 完整来源快照保留；可执行集合仅 ACTIVE；计数分开 |
| CSV 与 Header | CSV 永远字符串；Header 仅字符串；跨 JSON 标量不隐式转换 |
| 可选 body 变量 | 未绑定省略属性；绑定后缺值为 not_evaluable；展开对象的 required 子字段仍必填，完整 body 再验 Schema |
| Agent Schema | 实测对象闭合、字段 required；数组依样例合并类型，空数组 items 未知 |
| 代码入口/LLM | 同步 evaluate(inputs)；OpenAI-compatible chat completions 最小契约 |
| 超时/限制 | 主设计的 ExecutionPolicy 初始值；错误显式，不截断为成功 |
| 轮询第一个时间点 | 响应后立即读取，后续每 10 秒槽位；总时间不超 60 秒 |
| 试调用凭证 | 实际验证请求用户明确触发；不在保存时偷偷重复发送 |
| 验证回执 | 传输→解析→Trace 的单向依赖；派生 Schema 不使传输失效，重新生成说明不必重发 Agent |
| Numeric 均值 | binary64 输入精确 BigInt 聚合、最终 nearest-even；避免合法大数中间溢出变 null |
| 导出 | 终态 Run；长值分片，可逆重建；无隐式数据损失 |
| 签名与发布 | 无签名凭证可本地开发，不能宣称已完成可分发 release |

这些选择不代表用户曾逐项确认；如用户调整，先更新此记录、设计和验收，再实现。首版不展开 OAuth2、多租户、移动原生端、跨机器备份、自动更新或分布式队列。

## ADR-008：可强制的 TDD

AGENTS 与规范约束协作行为；本地 hook 可绕过，无法单靠文档“保证”。工程层实现可信 RED/GREEN 重放和 required checks；仓库层配置 main 保护，禁止直接写/force push/绕过；变更 gate 本身要独立审查。详细防绕过模型见[TDD gate](tdd_workflow.md#td-tdd-gates)。

Linux 门禁协调平台重放，不执行或 mock macOS 专属行为；相同目标测试的 RED/GREEN 使用相同平台与锁定工具链，缺少绑定当前阶段的可信平台证据不得放行。

当前没有产品代码、CI 工作流或远端保护配置，明确把这些作为 M0 验收，不夸大本次文档交付。新实现不得跳过 M0 先进入产品开发。
