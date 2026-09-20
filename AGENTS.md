# 项目协作规则

## 背景与阅读顺序

- 用户是翰文，AI 产品经理；回复简洁、直接、有依据。
- 用户本地使用 miniconda；不要修改其全局环境。开发工具链选定 Node 24 LTS / pnpm workspace，精确依赖版本在 M0 核验并锁定，不能使用浮动 latest；不要把 Python/conda 加成应用运行依赖。
- 开始工作先读 [README](README.md) 确认实际仓库状态，再读完整[严格 TDD 规范](docs/technical_docs/tdd_workflow.md)、本次涉及的[技术设计](docs/technical_docs/evalit_v001_technical_design.md)、[测试策略与验收规格](docs/technical_docs/testing_strategy.md)及[需求追踪矩阵](docs/technical_docs/traceability.json)。重要取舍见[技术决策](docs/technical_docs/decisions.md)。
- 规则优先级：用户明确补充 > [PRD](docs/product_docs/evalit_v001_prd.md) > 技术设计 > 视觉原型。发现冲突先说明并确认，不默默改变产品语义；本文件是执行摘要，不替代完整契约。

## 所有变更严格遵循 TDD

1. 技术设计：按[模板](docs/changes/TEMPLATE.md)建立或更新 CHG，明确需求、契约、影响路径、风险、回滚和验收；行为改变先同步技术设计，重大取舍补 ADR。
2. 测试：先写或增强测试，实际运行得到有效 RED。依赖缺失、编译错误、网络不可用不算行为失败；纯重构/测试/配置等按规范使用 characterization、mutation 或错误 fixture。
3. 实现：只做使断言通过的最小改动，再验证 GREEN 与必要回归；重构期间保持 GREEN。记录真实命令、环境、退出码、阶段引用与证据，不伪造 SHA 或补写未执行结果。
4. 同步与审查：功能、修复、重构、依赖、配置、CI、迁移、原型、文档均无豁免；所有改动路径须被 CHG 覆盖。行为变化同步技术设计、验收规格和追踪矩阵，不能只改代码或只补文案。
5. 门禁：禁止删断言、skip/only、降低门槛或修改待审 gate 给自己放行；可信 gate 使用受保护基线。默认保留 D/T/I 阶段证据，合入与压缩历史遵循 TDD 规范，不靠本地 hook 声称强制保障。平台相关 RED/GREEN 在相同 OS/架构/锁定工具链重放，macOS 测试不得以 Linux skip/mock 代替。

产品切片开始前完成 [M0 工程基础](docs/technical_docs/evalit_v001_technical_design.md#td-milestones)，gate 自身也要先行反例测试。当前只有文档检查已实现，产品 TC 是规格，CI/远端保护尚未部署；缺少真实平台或账号验证时标“未验证”，不能标“通过”。

## 架构与产品边界

- [进程职责](docs/technical_docs/evalit_v001_technical_design.md#td-architecture)：Renderer 不直接访问文件或网络；Main broker 统一管理 Core、编译与 Sandbox 进程及硬截止；Core 是 SQLite 唯一写者。旧进程 exit 后才交接恢复写者。domain 保持纯 TypeScript，不依赖 Electron、数据库、网络或 UI。
- [隔离执行](docs/technical_docs/evalit_v001_technical_design.md#td-sandbox)：不可信评估代码和 SSE 规则只在 QuickJS WASM 中运行，TS 编译使用纯内存 CompilerHost。禁止用 Node vm、宿主 eval、iframe 或正则去类型替代既定隔离；编译期和运行期都需越权否定测试。
- [持久化](docs/technical_docs/evalit_v001_technical_design.md#td-storage)：不可变对象版本和 Run 快照独立保存，完整快照 sealed 后才派发；使用独立阶段 CAS，产出文件/目录持久化先于 DB 引用提交。不得覆盖已提交终态、删除历史产出或用半份数据继续运行。
- [失败恢复](docs/technical_docs/evalit_v001_technical_design.md#td-recovery)：Agent/LLM 不自动重试，SSE 不自动重连，不在崩溃后续跑或重发；恢复只保留结果并终止未决阶段。目标不可用时一并终止未执行 Trace/evaluator，占位不能悬空；Trace 的定时读取轮询不等于业务重试。
- [Cloud 与 Trace](docs/technical_docs/evalit_v001_technical_design.md#td-trace)：Langfuse 首版使用 SaaS，只读 Dataset/Trace，不写 Score/Experiment 等远端数据；metadata 关联的是 Trace 自身的 Metadata，不得替换为根/任意节点私有 Metadata。Observation 选择发生在关联之后；真实接口不兼容须明确报错，不擅自放宽语义或 60 秒窗口。
- [安全与凭证](docs/technical_docs/evalit_v001_technical_design.md#td-security)：safeStorage/Keychain 不可用时失败，不回退明文；已存凭证不得解密回传 Renderer 或传给 Sandbox。保持 Electron 隔离、TLS 验证、日志脱敏，不把鉴权复制到快照或导出。普通测试数据默认本地明文，不宣称全库加密。
- [原型落地](docs/technical_docs/evalit_v001_technical_design.md#td-ui)：保留原型的视觉与交互依据，但 mock、localStorage、模拟调用、简化编译器及 iframe 沙盒不得进入生产路径。

## 按任务补读

| 变更范围 | 必读契约 |
| --- | --- |
| CSV、字段路径、Header/可选 body 输入 | [测试集](docs/technical_docs/evalit_v001_technical_design.md#td-dataset)、[映射](docs/technical_docs/evalit_v001_technical_design.md#td-mapping) |
| Agent 配置、SSE、试调用回执 | [HTTP/回执链](docs/technical_docs/evalit_v001_technical_design.md#td-http)、[SSE](docs/technical_docs/evalit_v001_technical_design.md#td-sse)、[IPC DTO](docs/technical_docs/evalit_v001_technical_design.md#td-ipc) |
| Cloud 数据读取 | [只读适配器](docs/technical_docs/evalit_v001_technical_design.md#td-langfuse)、[外部验证前提](docs/technical_docs/evalit_v001_technical_design.md#td-open-items) |
| 编辑、回滚、运行状态 | [版本](docs/technical_docs/evalit_v001_technical_design.md#td-version)、[运行编排](docs/technical_docs/evalit_v001_technical_design.md#td-run) |
| LLM 输出、统计、Excel | [LLM/输出契约](docs/technical_docs/evalit_v001_technical_design.md#td-llm)、[指标与导出](docs/technical_docs/evalit_v001_technical_design.md#td-export) |
| 平台、依赖、迁移、发布 | [交付与迁移](docs/technical_docs/evalit_v001_technical_design.md#td-delivery)、[测试分层与 CI](docs/technical_docs/testing_strategy.md#td-tests-ci) |

## 验证与交付

- 当前文档回归命令：`node --test tests/docs/technical-design.test.mjs`；随后运行 `git diff --check`，新增文件也须检查格式。未建立 package.json/workspace 前，不运行或宣称不存在的 pnpm 脚本已通过。
- 测试默认禁止真实外网，使用独立临时 userData、凭证 fake 和 fixture；不触碰用户真实数据库。真实 Cloud smoke 只读且显式启用，真实 LLM smoke 会产生成本，不能偷偷调用。
- 不提交真实凭证、用户数据或临时运行文件；保留用户已有改动，不将无关文件混入提交。
- 未经本次任务授权不自动 commit/push；完成后报告实际修改、实际验证和剩余限制。
