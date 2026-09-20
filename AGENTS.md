# 项目协作规则

- 用户是翰文，AI 产品经理；回复简洁、直接、有依据。
- 用户本地使用 miniconda；不要修改其全局环境。应用技术栈见技术设计。
- 本项目必须严格遵循“技术设计 → 测试 → 实现”，适用于功能、修复、重构、配置、依赖、CI、迁移、设计原型和文档。不得先实现后补测试。
- 开始变更前阅读相关[技术设计](docs/technical_docs/evalit_v001_technical_design.md)和[严格 TDD 规范](docs/technical_docs/tdd_workflow.md)，建立或更新 CHG 记录，明确验收与影响。
- 按规范先写/增强测试，实际验证有效 RED，再作最小实现并验证 GREEN。纯重构等使用规范规定的 characterization/mutation，不能伪造 RED。
- 不得以删除断言、skip/only、降低门槛、修改待审查 gate 放行自己的变更；所有改动路径均需有设计与测试证据。
- 修改产品行为必须同步技术设计和[需求追踪矩阵](docs/technical_docs/traceability.json)。文档变更也要运行对应检查。
- 产品实现前先完成 M0 的 TDD 门禁与基础设施；当前产品测试只是规格，不能将其描述为已经实现或通过。
- 用户明确补充优先于 PRD，PRD 优先于技术设计和原型；冲突需记录并确认，不默默改变产品语义。
- Langfuse 首版面向用户使用的 Cloud，只读 Dataset 与 Trace；不写远端数据。Agent/LLM 不自动重试，不在崩溃后重发。
- 不提交真实凭证、用户数据或临时运行文件。保留用户已有改动，不将无关文件混入提交。
- 未经本次任务授权不自动 commit/push；完成后报告实际修改、实际验证和剩余限制。
