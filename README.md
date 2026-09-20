# evalit

面向 Agent / LLM 的 macOS 本地评测工具，连接测试集、评估对象与评估器，保存运行快照并展示/导出结果。当前仓库包含产品需求、交互原型和技术设计，产品实现尚未开始。

## 文档入口

- [产品需求 PRD](docs/product_docs/evalit_v001_prd.md)
- [交互设计原型](designs/evalit-prototype.html) · [设计交接](designs/DESIGN-HANDOFF.md)
- [完整技术设计](docs/technical_docs/evalit_v001_technical_design.md)
- [测试策略与验收场景](docs/technical_docs/testing_strategy.md)
- [技术决策](docs/technical_docs/decisions.md) · [需求追踪矩阵](docs/technical_docs/traceability.json)
- [严格 TDD 工作流](docs/technical_docs/tdd_workflow.md) · [变更记录模板](docs/changes/TEMPLATE.md)
- [技术设计独立评审与修订记录](docs/changes/CHG-20260920-003.md)

## 开发约束

所有变更必须遵循“技术设计 → 测试 → 实现”。先有设计和有效 RED，再实现并验证 GREEN；重构、配置、文档同样适用。开始工作先阅读 [AGENTS.md](AGENTS.md)。

技术设计选用 Electron / React / TypeScript、SQLite 和受限 JS 执行引擎，Langfuse 首版以 Cloud 只读集成为准。尚未建立产品依赖、产品测试或 CI；工程初始化必须先完成 TDD 门禁，不能将文档规格当作已运行功能。

## 当前可运行的文档校验

使用 Node 24 LTS，无需安装第三方依赖：

```sh
node --test tests/docs/technical-design.test.mjs
```

本检查验证文档、链接、需求覆盖与场景追踪，不代表产品功能验收。实际本次记录见 [CHG-20260920-001](docs/changes/CHG-20260920-001.md)。
