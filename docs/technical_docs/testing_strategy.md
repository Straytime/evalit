# 测试策略与可执行验收规格

版本 techv_0.2；2026-09-20。对应[技术设计](evalit_v001_technical_design.md)、[TDD 工作流](tdd_workflow.md)和[机器可读追踪矩阵](traceability.json)。独立评审修订见 [CHG-003](../changes/CHG-20260920-003.md)。

当前下面的 TC-* 均是待实施的测试规格，不是“已经通过”的产品测试。只有 tests/docs/technical-design.test.mjs 已在文档变更中实际运行，执行记录见[初始设计](../changes/CHG-20260920-001.md)及[独立评审修订](../changes/CHG-20260920-003.md)。

<a id="td-tests-layers"></a>
## 1. 分层与真实边界

| 层 | 工具与对象 | 不允许的替代 |
| --- | --- | --- |
| unit | Vitest + fast-check；纯映射/状态/输出/版本/解析函数 | 不仅断言内部函数调用次数而忽略输出语义 |
| integration | 真实 SQLite 临时库、真实 WASM/utility process、本地 HTTP/SSE server | 不把所有 adapter mock 后称集成 |
| contract | 固定脱敏 Cloud/兼容 LLM HTTP fixture + opt-in 只读真实 smoke | Mock 成功不等于真实 SaaS 已验证 |
| component | Testing Library；可访问角色、用户事件、窄 IPC fake | 不依赖 className 和 DOM 内部细节锁死重构 |
| e2e | Playwright renderer 与 Electron launcher、真实打包与 IPC | 不只用普通浏览器替代桌面主进程测试 |
| governance | Node test + gate 反例、文档/架构检查 | 不由待审查 PR 自定义返回成功的门禁 |

Electron 的 Playwright 支持标为 experimental，封装统一 launcher 并锁定组合版本；原生文件对话框用 FileDialogPort 注入受控测试路径，同时保留每版 macOS 原生对话框人工冒烟。不能伪称 Playwright 自动化已覆盖所有原生 OS UI。[Playwright Electron](https://playwright.dev/docs/api/class-electron)

文件建议：tests/unit/<module>/*.test.ts、tests/integration/<module>/*.test.ts、tests/contract/<adapter>/*.test.ts、tests/component/<feature>/*.test.tsx、tests/e2e/*.spec.ts；每个测试名包含 TC ID，可一条 TC 分解为多个参数化断言。路径为计划结构，目前未建立。

## 2. 测试基础设施

- Clock、IdGenerator、Transport、SecretStore、ArtifactStore 和 Repository 通过端口注入；业务用例默认禁止真实外网。
- Trace 轮询使用虚拟时间验证 0/10/20/30/40/50/60 秒；另保留真实子进程硬超时测试，不靠 fake timers 证明进程会被杀死。
- HTTP fixture server 支持请求记录、分页、乱序、错误码、连接断开、延迟、SSE 字节切片和实际请求次数；每个测试独立端口。
- 数据库测试真实临时文件，启用与生产相同 PRAGMA；事务/并发/迁移测试不能只用 in-memory repository。
- 每个测试独立 userData、凭证 fake、随机端口和临时目录；清理仅命中本测试创建的资源，不碰用户真实数据库。
- 种子随机固定且失败输出 seed；性质测试至少覆盖 JSON Pointer 转义、版本整数转换、状态聚合与序列化字节边界。
- 真实 Cloud smoke 只读，用预先存在的专用测试项目，不自动创建 Dataset/Trace；真实 LLM smoke 会产生成本，单独手动启用。没有环境条件即“未验证”，不能纳入已通过 release 证据。
- 安全测试使用 canary 文件/本地 trap HTTP server 判断是否真有越界副作用，不只断言某标识 undefined。
- 故障注入点覆盖 intent 前后、HTTP 返回前后、artifact rename 前后、DB commit 前后、Run 汇总前后。

<a id="td-tests-cases"></a>
## 3. 验收场景清单

下表的每行是一组有共同契约的最小验收族，实施时拆成独立测试；Given/When/Then 不可省略。新增行为须先补这里与追踪矩阵，再写失败测试。

| ID | 层级 | Given（前置） | When（操作） | Then（预期） |
| --- | --- | --- | --- | --- |
| TC-LF-01 | contract | 同一 Cloud 项目有两组 API Key，region 不同另算来源 | 分别校验并添加连接 | 读取实际 projectId/name；同 region 同项目拒绝重复，凭证 DTO 脱敏 |
| TC-LF-02 | integration | 远端 Dataset 含 125 项，预览页长 10 | 翻预览至末页并选择两个 Dataset 导入 | 预览最多 50 项；创建两个关联，不合并、不缓存全部数据 |
| TC-LF-03 | contract | Dataset 分三页且拉取期间被修改，支持时间点版本 | 创建 top 2 Run | 每页携带同一 version，全量 125 项快照完成后仅选源序列前 2 项 |
| TC-LF-04 | integration | 第二页报错/重复 ID/源版本不支持/只有归档项 | 初始化运行 | 明确失败且无 target 调用，不使用部分页或旧预览兜底 |
| TC-LF-05 | contract | Fake Cloud 接口记录所有 HTTP 方法与结构化 filter | 读取 Dataset、按 metadata 与时间筛选 Trace | 仅白名单 GET；filter 内含完整时间条件，绝不写 Score/Experiment |
| TC-LF-06 | contract | 一个 Trace 跨多 cursor 页且 metadata 超 200 字符 | 拉完整轨迹并展开 metadata | 取全节点/字段，无截断；全量完成后才能作为一轮候选 |
| TC-LF-07 | contract | 可用的真实 Cloud 测试账号和事先准备的 Dataset/Trace | 手动启用只读 smoke | 验证地区、分页/version、顺序、metadata 及可见延迟；缺凭证标未验证而非通过 |
| TC-LLM-01 | contract | 连接列出两个模型，第二个拒绝 temperature | 校验 LLM 连接 | 逐模型实际调用且无自动重试；错误清晰，不能把不支持参数静默删除 |
| TC-LLM-02 | unit | Prompt 同时含重复变量，值包括 0/false/对象/双括号文本 | 提取变量并渲染 | 集合去重；JSON 值明确文本化；插入文本不再次执行模板替换 |
| TC-LLM-03 | integration | 兼容服务返回超时、tool-only 或无 content | 执行 PromptTarget 与 LLM evaluator | 每阶段最多一请求，按契约失败，不用供应商专属回退 |
| TC-DATA-01 | unit | CSV 包含 BOM、引号逗号、多行、中文、001 和空单元格 | 解析并映射 | 字符和值原样保留，原始顺序一致，数字样式不自动转型 |
| TC-DATA-02 | unit | CSV 有空/重复表头、列数不齐或无数据行 | 导入校验 | 定位源行/列并拒绝，不静默丢行或自动修复 |
| TC-DATA-03 | unit | 单列与多列分别映射 input/expectedOutput/metadata | 构建标准用例并编辑原始值 | 单列为字符串，多列为原表头 Key 对象，未映射列仍保留 |
| TC-DATA-04 | integration | CSV 125 行且第 100 行 input 无效 | 预览并确认保存 | 只预览 50，但全量验证发现第 100 行错误，禁止只导入预览 |
| TC-DATA-05 | integration | 本地 Dataset 已被计划引用 | 尝试删至零行、移除映射、单列变组合，再合法加映射 | 非法编辑全部拒绝，合法变更有影响列表并生成完整新版本 |
| TC-MAP-01 | unit | JSON Key 含点/斜杠/波浪号/引号，包含嵌套数组 | 用 UI 路径规范化后读取 | 准确单节点解析，转义往返一致，越界返回 Missing |
| TC-MAP-02 | unit | 字段值分别 Missing/null/空白/0/false/空数组/空对象 | 解析 evaluator 输入 | 前三类缺失，后三类及 0 有效；不使用 truthiness 判断 |
| TC-MAP-03 | unit | 计划少一 Header 绑定或有重复/未知变量、target 引用输出来源 | 创建或编辑计划 | 保存拒绝并定位变量；合法独立命名空间可保存 |
| TC-MAP-04 | integration | Header 变量映射字符串/数值/布尔/null | 逐行准备 target | 字符串原样发送；数值布尔 failed；null not_evaluable；无效行零请求 |
| TC-MAP-05 | integration | 可选 body 变量未绑定/已绑定但缺值，另有可选父对象内 required 子字段 | 保存计划并构造完整 body | 未绑定可选属性省略；已绑定缺值 not_evaluable；展开父对象的 required 仍须绑定，结构不合 Schema 零请求 |
| TC-HTTP-01 | unit | curl 含内联 JSON、@file、命令替换、多 URL、未知参数 | 解析导入 | 安全子集正确；其余明确拒绝；无 shell/文件读取/网络调用 |
| TC-HTTP-02 | unit | OpenAPI 有 servers、path 参数、内部引用、nullable、安全方案 | 选 Operation 并补必要值 | 生成可核验请求；外部/循环/无法无损转换 Schema 拒绝；参考响应不代替实测 |
| TC-HTTP-03 | integration | 试调用已通过后用户改 endpoint/Header/body/凭证，另只改 SSE 说明 | 尝试用旧回执保存 | 请求变更需新 TransportReceipt；说明变更可复用样本但旧 ParseReceipt 失效，重生成/确认后才可保存 |
| TC-HTTP-04 | unit | Header 大小写重复、CRLF、系统 Header、鉴权或 traceparent 冲突 | 构建配置或请求 | 精确报告冲突，不覆盖、不发送非法请求 |
| TC-HTTP-05 | integration | 锁定响应含嵌套对象/数组/nullable | 响应变类型/少 Key/多 Key，另有合法响应 | 不符合锁定 Schema 的 target failed；合法输出可供下游 |
| TC-HTTP-06 | integration | Bearer/Basic/API key 放于 Header 或 query | 试调用、保存与读取快照/日志 | 实际传输鉴权正确，持久化只留 secretRef，日志与 DTO 无明文 |
| TC-HTTP-07 | integration | 首次 SSE 创建、多次改说明生成规则、随后开启 Trace 注入 | 确认规则/Schema，再独立验证 Trace 并保存 | 无 Trace 只需一次 Agent 请求；开启后通常两次，总链无循环；派生 Schema 不废弃传输回执，保存零请求 |
| TC-SSE-01 | unit | UTF-8 字节分片、多行 data、CRLF、注释、done 标记及尾部不完整事件 | 逐 chunk 解析至正常 EOF | 完整事件顺序正确，done 不提前结束，未封帧尾部不伪造事件 |
| TC-SSE-02 | integration | SSE 收到部分内容后 RST/一直不关闭/超过字节限额 | 等待完整响应 | target failed；无自动重连，保留阶段诊断但不展示为成功输出 |
| TC-SSE-03 | integration | 用户配置 LLM 并两次修改说明生成规则 | 生成、确认，然后正式执行两条用例 | 每次生成无聊天历史且含完整样例；正式调用用固定规则，零生成 LLM 请求 |
| TC-SSE-04 | integration | 生成规则无限循环/调用宿主 API/输出过大，或完整输入超生成限额 | 验证规则 | 隔离拒绝/硬截止，无法获得确认回执，不截断样例冒充全量 |
| TC-SB-01 | integration | TS 含 interface/type、JS 合法模板、语法错和 import | 编译与运行真实 Sandbox | 真实编译器接受受支持 TS；错误/import 拒绝；结果符合声明契约 |
| TC-SB-02 | integration | 恶意代码访问 process/env/fs/fetch/require/constructor 链 | 执行真实 WASM 隔离上下文 | 无法获得任何宿主能力；不会读写 canary 文件或发出网络包 |
| TC-SB-03 | integration | 无限循环、灾难性正则、递归、超量内存和 getter/toJSON | 执行并等待父进程截止 | 5 秒执行预算后被中断/终止，其他任务与 Core 仍可运行 |
| TC-SB-04 | unit | 输出含多字节字符，长度为 99999/100000/100001 字节 | 校验输出限额 | 前两者允许且契约合法，100001 失败；不按字符串字符数算字节 |
| TC-SB-05 | integration | 连续两次执行，首次修改全局变量和内建原型 | 创建两次干净 Sandbox 并执行 | 第二次无前次状态；句柄/进程释放，无持续资源增长 |
| TC-SB-06 | integration | TS triple-slash path 指向 canary，另含 types/lib/JSDoc import 和允许的内置类型 | 执行真实编译进程并记录虚拟 host/宿主 I/O | 外部引用拒绝、canary 零读取且零网络；白名单类型正确编译，诊断不泄漏宿主路径或文件内容 |
| TC-OUT-01 | unit | 输出原文含裸对象/单 JSON 围栏/解释文字/多围栏/数组根 | 解析 evaluator 输出 | 仅严格两种对象形式通过，其余整个结果失败 |
| TC-OUT-02 | unit | 指标值为 0/false/空白/null/错类型/未知分类/缺 Key | 按 numeric/boolean/text/categorical 校验 | 0/false 有效，其他违约结果整体 failed；准确字段和类型 |
| TC-OUT-03 | integration | 合法指标带额外 Key，或无法解析的 LLM 原文含 canary | 保存、查询、统计和导出 | 额外 Key 只明细/导出；非法原文不进 DTO/日志/XLSX；统计不采样失败字段 |
| TC-TRACE-01 | unit | 关联模式分别响应 ID、W3C 注入、metadata | 构建实际请求与查询 | 响应 ID 原值使用；生成非零合法 traceparent；metadata 类型敏感精确匹配 |
| TC-TRACE-02 | unit | 虚拟时钟下依次 0/1变化/1一致，另有 60 秒仍变化 | 推进槽位与截止 | 10 秒固定槽位；连续一致成功，截止取最后完整唯一候选并标不稳定 |
| TC-TRACE-03 | integration | 同轮多页重复同一 traceId，另一个 fixture 含两个不同 ID | 查询全部页并去重 | 同 ID 不判多 Trace；两个 ID 立即失败且不给下游任何 Trace |
| TC-TRACE-04 | unit | Trace 有同名祖孙、同名兄弟、名称大小写差异和无命中 | 选择 Observation 子树 | 全部匹配并含后代，每 ID 只一次；无命中 []，空名称整轨迹 |
| TC-TRACE-05 | integration | Trace 拉取失败但 target success，评估器分别依赖 Trace/仅输出 | 运行用例 | target 保持 success；前者 not_evaluable，后者正常执行，case 按全部终态聚合 |
| TC-TRACE-06 | unit | API 行序和对象键序变化，但节点业务值相同；随后新增节点 | 计算稳定签名 | 仅顺序变化不打断稳定，业务变化打断；fetchedAt 不进入签名 |
| TC-TRACE-07 | unit | Observation 有外部父节点、自环、环和冲突重复 ID | 重建 TraceEnvelope | 外部父节点保留 orphan 标记；损坏图拒绝，不死循环或默默丢节点 |
| TC-TRACE-08 | contract | Trace metadata 与节点私有 metadata 有同名不同值，另含 Trace 属性传播副本及数字/字符串差异 | 按 Trace.metadata.B 精确关联，再读取整条 Trace | 节点私有值不误命中；传播副本按 traceId 去重；不要求根节点；API 无法区分来源时明确不兼容 |
| TC-PLAN-01 | integration | 三个对象及非空 evaluator 集合，全部映射齐全 | 创建计划，再修改对象当前版本 | 计划仍引用实体 ID；下一 Run 冻结新版本，历史 Run 保持原值 |
| TC-PLAN-02 | integration | 计划尝试替换 target/dataset/evaluator 集合或保留未映射输入 | 编辑保存 | 仅合法映射修改生成版本；成员变更和缺失映射拒绝 |
| TC-LIFE-01 | integration | 对象分别未引用、被正常/归档计划或历史运行引用 | 删除或归档测试集/对象/评估器/计划 | 只有无引用者经确认可硬删；其余归档；历史可读，归档计划不能运行 |
| TC-LIFE-02 | integration | 连接被对象保留版本或活动 Run 使用 | 请求删除连接 | 返回引用清单并阻止，零悬空外键；无引用连接可删除 |
| TC-VER-01 | unit | 版本 counter=9 且已有 10 份历史 | 保存和回滚历史版本 | 0.9→1.0；回滚复制新版本；counter 不倒退，最多 10 份 |
| TC-VER-02 | integration | 本地 Dataset 新增映射，Agent 从 Trace 关闭变开启 | 回滚到不含映射/关闭 Trace 的旧版本 | 拒绝；合法回滚成功；历史 Run 与凭证引用不受版本淘汰影响 |
| TC-VER-03 | integration | 两个编辑者基于同一 revision，代码/Prompt 指标/变量已锁定 | 先后保存或尝试改变锁定字段 | 第二保存 CONFLICT；锁定字段拒绝；无内容变化不加版本 |
| TC-VER-04 | integration | Agent 存在固定与变量 Header/body，开启 Trace | 编辑配置并重新试调用 | 固定值可变，变量不可增删改；响应 Schema 不匹配拒绝新版本 |
| TC-RUN-01 | integration | 双击产生同一 requestId，远端 Dataset 尚未拉完 | 创建和启动运行 | 只有一个 Run；sealed 前零 target 调用；占位覆盖 selected×evaluator |
| TC-RUN-02 | integration | 多个用例、LLM/code/Trace 延迟不同，并发上限均已配置 | 运行并记录每类实时在途数 | 上限从不超限；Trace 等待不占 target 名额，失败不取消其他任务 |
| TC-RUN-03 | unit | 所有 target/evaluator 终态组合含合法 false/0 | 用属性测试穷举并聚合 | case/run 状态严格等于 PRD；业务负面值不等于执行失败 |
| TC-RUN-04 | integration | 封存后修改当前版本、模型配置/Key、远端 Dataset | 继续执行并查看历史 | 只使用冻结内容/secretRef；历史结果不随当前对象变化 |
| TC-RUN-05 | integration | 多个 Run 入队、页面关闭/重开、事件丢失/重复 | 观察 FIFO 与补齐查询 | 一次一个活跃 Run；页面不控制调度；seq 去重/补查，进度正确 |
| TC-RUN-06 | integration | 同 case 两个 evaluator 并发且各有独立 stage token | 同时/乱序完成，再发重复回调与旧 epoch 结果 | 两个有效结果都持久化；各终态/事件/计数只写一次，重复及旧结果不覆盖 |
| TC-RUN-07 | integration | 已建 queued Trace 占位，target 输入缺失/HTTP失败；恢复 fixture 另含已失败 target 及未开始 Trace | 正常终止与崩溃恢复 | target 不可用时 Trace/evaluator 同事务 not_evaluable；target 成功但 Trace 中断时按恢复表终止；所有占位终态、零补调用 |
| TC-REC-01 | integration | 在初始化/target/Trace/evaluator/汇总各持久化边界强杀 Core | 重启应用 | 按恢复表终止未决阶段、保留已提交结果、外部请求次数不增加 |
| TC-REC-02 | integration | HTTP 已成功但提交前崩溃；另有 intent 后发送前崩溃 | 恢复运行 | 两者都不重发，不声称外部 exactly-once，显示可解释的中断原因 |
| TC-REC-03 | integration | 注入磁盘满、artifact rename 失败、SQLite commit 失败 | 完成阶段或初始化 | 停止新派发，无未持久化成功 UI；无指向半文件的已提交记录 |
| TC-REC-04 | integration | Sandbox 忽略 SIGTERM、旧 Core 崩溃、旧 task 超时回调晚到，fixture 模拟 PID 复用 | Main broker 硬终止并重建服务 | 等旧 Core/worker 全部 exit 才换 epoch；不误杀新任务、不提前放名额、不出现双写者 |
| TC-REC-05 | integration | 在文件同步/rename/目录同步/DB commit 边界注入中断及屏障失败，另损坏已引用文件 | 恢复并读取产出，使用故障文件系统模拟丢失未同步目录项 | 屏障未完成无引用提交；哈希不符/缺文件标损坏不冒充完整成功，不自动调用，确定无引用临时文件才清理 |
| TC-MET-01 | unit | success 有 0/false，各类失败结果混合，另有 n=0 | 聚合所有指标 | 只用 success 分母；展示覆盖数，n=0 无 NaN/假 0，无统一通过率 |
| TC-MET-02 | unit | [1e308,1e308]、最大有限值、异号相消、小值与次正规数、负零 | 计算 numeric 均值并对比独立精确有理数 oracle | 均值有限、nearest-even 正确、零规范化；不把中间溢出变成 null，IPC/XLSX 保留同值 |
| TC-XLSX-01 | integration | 终态 Run 含全部字段、指标、extra Key、错误和 Trace | 导出再用独立 reader 读取工作簿 | 真实 XLSX 可读，所有业务数据与运行快照一致，无非法 LLM 原文 |
| TC-XLSX-02 | integration | 文本以公式字符开头，超 32767 字符且含 emoji/控制字符 | 导出并重组 Payloads | 无公式执行；可逆重组、无字符丢失；分片不拆代理对 |
| TC-XLSX-03 | integration | 用户取消保存或文件写入中断 | 执行导出 | 不覆盖既有文件、不留下最终半文件，Run 保持不变 |
| TC-IPC-01 | integration | 不可信 sender、未知 channel、畸形 DTO、任意文件路径 | 调用 preload/Main 边界 | 拒绝且无 DB/网络/文件副作用；真实受信调用通过 |
| TC-IPC-02 | component | 快速修改表单触发两个异步校验且响应乱序 | 后发请求先返回 | 旧结果不覆盖新输入；禁用/错误状态可访问且字段定位准确 |
| TC-IPC-03 | integration | 首次 SSE 无 parser，经生成确认后开启 Trace 注入，另有过期 Draft/旧组合 ID | 经固定 IPC 完成传输→解析→Trace→保存 | SSE 传输不伪造 Schema；Trace 返回新链并可保存，通常两次 Agent 请求、保存零请求；旧 ID/乱序更新拒绝 |
| TC-SEC-01 | e2e | 正式 Electron 配置、外部恶意 HTML/链接/脚本 | 打开应用并尝试导航/执行/读取 Node | sandbox/contextIsolation 保持开启，远程内容当文本，无权限逃逸入口 |
| TC-SEC-02 | integration | SecretStore 可用/不可用、两代凭证被历史版本引用 | 保存、读取、轮换、清理 | 不可用拒绝明文降级；新旧 secretRef 隔离且已引用密文不删除 |
| TC-MIG-01 | integration | 空库、上一版本库、未知更高版本库和迁移中途错误 | 启动/重复启动/故障迁移 | 空库创建、旧库升级、checksum 一致；高版本拒绝写；失败可还原且历史完整 |
| TC-UI-01 | component | 全模块 loading/empty/error/disabled/success 和键盘用户 | 表单/映射/版本/删除确认交互 | 操作可达、焦点正确、禁用有原因、无仅颜色状态与必需拖拽 |
| TC-UI-02 | e2e | 离线 fixture 服务及打包应用 | CSV→Agent/Header→代码+LLM→计划→运行→统计→导出 | 核心闭环无需手工修改存储，每步使用真实应用服务与 SQLite |
| TC-UI-03 | e2e | 固定字体/数据/动画时钟，原型规定九组视口 | 截图并执行可访问性与溢出检查 | 保持设计 token/布局与交互，无整页水平溢出，差异须人工核验 |
| TC-PACK-01 | e2e | arm64/x64 安装包及全新独立 userData | 启动、读取 SQLite、加载 WASM、执行 TS、关闭重开 | 无需系统 Node/conda；ABI/WASM 可用，凭证与历史保留 |
| TC-PERF-01 | integration | 固定硬件和 10000 行 fixture、并发 3 | 测分页/内存/UI可交互及大输入边界 | 满足初始预算，超限明确失败不截断，测量数据进入证据 |
| TC-TDD-01 | governance | 变更缺设计/测试，或只有实现后编造的 GREEN | 执行受信 gate | 拒绝合入并准确说明缺失阶段，正常完整链路通过 |
| TC-TDD-02 | governance | RED 是 import error/网络失败或测试被删、skip/only | 复验 RED/GREEN 证据 | 不认作有效 RED；禁止靠削弱断言通过 |
| TC-TDD-03 | governance | PR 同时修改 gate/workflow 或试图传任意命令 | 运行可信基线门禁 | 使用受保护 gate 和固定命令，恶意修改不能给自己放行 |
| TC-TDD-05 | governance | CHG 同时包含通用单元测试与 macOS 原生目标测试，存在缺证据/伪平台/skip 反例 | 协调相应平台重放同一目标测试的 RED/GREEN | Linux 与 macOS 证据绑定阶段/测试/工具链；缺失不通过，不能以平台 skip 代替成功 |
| TC-TDD-04 | governance | 纯重构/测试/文档/依赖改动并有代表性错误 fixture | 按变更类型执行先行验证 | 正常行为通过，mutation/错误 fixture 失败；所有路径仍可追踪 |
| TC-DOC-01 | governance | PRD 功能或设计锚点/场景引用发生变化 | 运行本次文档检查 | 缺功能、重复 ID、失效链接/锚点或孤立场景均失败 |

<a id="td-tests-gates"></a>
## 4. 合入与发布门槛

所有改动必须通过适用测试和现有回归，禁止为了 RED 人为制造语法错误。覆盖率衡量已实现的生产代码，测试/生成 DTO/vendor 不计；排除项要有依据，不能因分支难测就排除。

| 门槛 | 标准 |
| --- | --- |
| 核心领域 | 映射、状态机、指标、版本、快照/重试不变量的已列行为 100% 有测试；line ≥95%，branch ≥90% |
| 已实现生产模块整体 | line ≥85%，branch ≥80%；新增代码不得降低所属模块门槛 |
| 安全/持久化/集成 | 对应 TC 全部通过，无“flaky 重跑后算过” |
| Mutation | 核心纯规则目标 mutation score ≥80%；幸存项逐一解释，不能把等价变异当 bug |
| 契约 | 每次 adapter 修改跑离线 fixture；正式发布前跑用户所用 Cloud 功能真实只读 smoke |
| 桌面 E2E | 关键业务闭环 + 崩溃恢复 +打包可启动，无未解释 skip |
| 视觉 | 固定 fixture/字体/动画；逐差异核验后更新基线，禁止批量无审查接受 |
| 迁移 | 从上一发布库升级、重复启动、失败可恢复、历史快照可读 |
| 证据 | 同一目标测试 RED→GREEN 可复验；真实命令/版本/日志摘要；工程 gate 本身有反例 |

不要求所有代码行 100% 覆盖来制造脆弱测试；对硬性业务与安全不变量则不允许缺用例。测试失败必须修复根因或先变更设计契约，不能为赶进度降门槛。

<a id="td-tests-ci"></a>
## 5. CI 矩阵与命令契约（待 M0 实现）

| Job | 环境 | 内容 |
| --- | --- | --- |
| docs | Linux + 固定 Node | 文档检查、需求追踪 |
| tdd-replay-linux / tdd-replay-macos | 分别为 Linux / macOS 受信 runner | 按目标测试平台重放 RED/GREEN；macOS 原生行为不在 Linux skip/mock 替代 |
| tdd-gate | Linux 可信协调器 | 校验并汇总全部必需平台证据，固定 required check；不在 Linux 伪造 macOS 执行 |
| quality | Linux | frozen lockfile install、typecheck、lint、architecture、unit、coverage |
| integration | Linux + macOS | SQLite、HTTP/SSE、WASM 与进程边界、migration/recovery |
| renderer-e2e | Linux Chromium | 路由/组件串联、响应式视觉、键盘与无障碍 |
| desktop-e2e | macOS | Electron 主/渲染进程、IPC、userData、真实打包/WASM/native ABI |
| release-smoke | macOS arm64/x64 | 安装启动、原生对话框、签名、公证、升级、Cloud opt-in 契约 |

M0 将实现 pnpm test:unit、test:integration、test:contract、test:component、test:e2e、test:visual、test:docs、test:tdd、typecheck、lint、check:architecture。此处仅约定命令，当前不能运行不存在的脚本并声称通过。

测试 job 并行但实现依赖串行：先技术设计再测试再实现；“CI 并行”不能用来改变 TDD 次序。CI 不注入生产凭证给 PR；Cloud/LLM smoke 在受信、显式启用的环境执行。

同一目标测试的 RED/GREEN 必须使用相同 OS/架构/工具链，按 CHG 类型选用固定可信命令。平台清单由受保护的测试分类和路径规则求并集，PR 不得自行删除 macOS 要求。证据绑定 changeId、D/T/I tree、最终提交、test ID、命令模板版本、OS/arch、工具链/lockfile、日志摘要及 CI run/job ID；协调器检查来自本次受信工作流的对应阶段结果，平台结果缺失/失败/skip 均不得通过。平台升级本身按依赖/配置的兼容 fixture 规则测试，不拿不同平台的 RED 与 GREEN 伪装同一环境行为修复。

## 6. 测试数据与验收组合

固定 Dataset 至少包括 1/50/51/125 行、嵌套 JSON、特殊 Key、0/false/null、空数组、缺路径、超长中文/emoji。Evaluator fixture 含四类指标、多 evaluator、额外 Key 和一条契约失败；Agent fixture 覆盖阻塞/SSE、三种 Trace 模式、固定/变量 Header。

最小业务组合：本地 CSV + Agent + code；远端 Dataset + Prompt + LLM；Agent SSE + Trace + 多 evaluator；编辑/回滚后旧 Run 不变；混合失败且统计分母正确；中断不重复调用；XLSX 无损导出。每个测试仍要独立可重现，不共享上个测试保存的 UI 状态。
