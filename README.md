# evalit

面向 Agent / LLM 的 macOS 单用户本地评测工具：连接测试集、评估对象与评估器，保存运行快照并展示、导出结果。首版不建设服务端、多租户或云同步。

## 当前状态

需求基线为 PRD `docv_0.3`，技术设计基线为 `techv_0.2`，已完成三轮独立评审，过程见 [CHG-20260920-003](docs/changes/CHG-20260920-003.md)。

仓库已有产品需求、交互原型、完整技术设计、TDD 规范和可运行的文档检查。产品实现尚未开始，M0 尚未实施；没有可启动的桌面应用、安装包或产品启动/构建脚本。测试策略中的 TC-* 是产品验收规格，不是已通过的产品测试；可信 CI 和远端保护也尚未部署。

## 规划能力（尚未实现）

- 测试集：本地 CSV 导入与编辑，关联 Langfuse Cloud Dataset，运行前保存完整数据快照。
- 评估对象：JSON HTTP / SSE Agent、Prompt；支持请求 Body/Header 变量及 Trace 关联。
- 评估器：受限 TS/JS 代码与 LLM 评估器，显式输入映射和严格指标契约。
- 评估运行：并发执行、阶段持久化、独立失败处理、版本与回滚、指标统计及 Excel 导出；不自动重试或在崩溃后续跑。

## 技术方案

已选定 Electron / React / TypeScript strict、SQLite、QuickJS WASM，以及 Vitest / Playwright 等测试工具；这些是选型，不是已安装依赖。详见[架构设计](docs/technical_docs/evalit_v001_technical_design.md#td-architecture)。

Renderer 通过窄 IPC 交互；Main 管理桌面能力、凭证与子进程；Core 是数据库唯一写者，负责领域服务、网络与调度；不可信代码在独立进程内的 QuickJS 执行，TS 编译也隔离宿主文件访问。

开发工具链设计为 Node 24 LTS + pnpm workspace，具体版本、锁文件及 Electron 原生模块兼容性在 M0 落实。最终安装包计划自带所需运行时，不要求使用者另外安装 Node、Python、conda 或 Docker；保留开发机已有 miniconda 环境。

## 文档入口

- [产品需求 PRD](docs/product_docs/evalit_v001_prd.md)
- [交互设计原型](designs/evalit-prototype.html) · [设计交接](designs/DESIGN-HANDOFF.md)
- [完整技术设计](docs/technical_docs/evalit_v001_technical_design.md) · [实施里程碑](docs/technical_docs/evalit_v001_technical_design.md#td-milestones)
- [测试策略与验收场景](docs/technical_docs/testing_strategy.md)
- [技术决策](docs/technical_docs/decisions.md) · [需求追踪矩阵](docs/technical_docs/traceability.json)
- [严格 TDD 工作流](docs/technical_docs/tdd_workflow.md) · [变更记录模板](docs/changes/TEMPLATE.md)
- [技术设计独立评审与修订记录](docs/changes/CHG-20260920-003.md)

## 开始开发

1. 阅读 [AGENTS.md](AGENTS.md)、严格 TDD 规范，以及本次变更相关的设计、验收规格和追踪条目。
2. 按变更模板建立 CHG，遵循“技术设计 → 测试（有效 RED）→ 实现（GREEN 与回归）”；重构、配置、依赖和文档同样适用。
3. 首先完成 M0 的可信 TDD 门禁与工程基础，再按里程碑推进产品切片。门禁本身也需先行反例测试，不能以文档规范代替已部署的强制检查。

规则优先级为用户明确补充 > PRD > 技术设计 > 原型；原型只作为视觉和交互依据，其中模拟服务、存储及沙盒不是正式实现。

## 当前可运行的文档校验

在仓库根目录使用 Node 24 LTS，无需安装第三方依赖、配置 Cloud 凭证或调用外部服务：

```sh
node --test tests/docs/technical-design.test.mjs
```

本检查验证文档、链接、需求覆盖、场景追踪及显式契约，不代表产品功能或真实 Cloud 兼容性验收。后续产品测试命令在 M0 建立，目前不提供尚不存在的安装、启动或构建指令。

## 数据边界与待验证项

Langfuse 首版面向 SaaS，只读 Dataset/Trace，不写远端评估数据。metadata 关联始终匹配 Trace 自身的 Metadata，不能用节点私有 Metadata 替代；真实账号的等价读取、60 秒可见性及固定版本分页仍需验证，Mock 通过不能证明兼容。

“本地工具”不等于离线评估：评估请求及相关输入会发往用户配置的 Agent/LLM；Langfuse 接收读取所需的鉴权和查询条件，不上传测试集或评估结果。设计要求凭证使用 safeStorage/Keychain 保护，普通测试数据和业务输出默认本地明文，这不是全库加密。详见[安全与数据边界](docs/technical_docs/evalit_v001_technical_design.md#td-security)。

macOS 持久化与进程边界、SQLite/WASM 打包、双架构兼容、签名及公证须在对应阶段实测。完整清单见[外部前提与待验证项](docs/technical_docs/evalit_v001_technical_design.md#td-open-items)；缺少验证时不得宣称相关能力完成。
