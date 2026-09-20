import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const base = 'docs/technical_docs/';
const artifacts = [
  `${base}evalit_v001_technical_design.md`,
  `${base}testing_strategy.md`,
  `${base}tdd_workflow.md`,
  `${base}decisions.md`,
  `${base}traceability.json`,
  'docs/changes/TEMPLATE.md',
  'docs/changes/CHG-20260920-001.md',
  'docs/changes/CHG-20260920-002.md',
  'docs/changes/CHG-20260920-003.md',
  'AGENTS.md',
  'README.md',
];
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const matrix = () => JSON.parse(read(`${base}traceability.json`));
const withoutCode = (text) => text.replace(/^```[^\n]*\n[\s\S]*?^```\s*$/gm, '');

function assertReference(source, ref) {
  const [path, anchor] = ref.split('#');
  const target = path ? resolve(root, dirname(source), path) : resolve(root, source);
  assert.ok(target === root || target.startsWith(`${root}/`), `链接越出仓库：${source}: ${ref}`);
  assert.ok(existsSync(target), `失效链接：${source}: ${ref}`);
  if (anchor) {
    assert.ok(readFileSync(target, 'utf8').includes(`<a id="${anchor}"></a>`), `缺少显式锚点：${source}: ${ref}`);
  }
}

function scenarios() {
  const rows = read(`${base}testing_strategy.md`).split('\n').filter((line) => /^\| TC-[A-Z]+-\d+ \|/.test(line));
  return rows.map((line) => {
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    assert.equal(cells.length, 5, `场景需有 ID、层级、Given、When、Then 五列：${line}`);
    const [id, level, given, when, then] = cells;
    assert.ok(['unit', 'integration', 'contract', 'component', 'e2e', 'governance'].includes(level), `无效层级：${id}`);
    for (const value of [given, when, then]) assert.ok(value.length > 3, `场景缺少验收语义：${id}`);
    return { id, level };
  });
}

test('约定的技术设计与治理产物完整', () => {
  for (const path of artifacts) assert.ok(existsSync(resolve(root, path)), `缺少产物：${path}`);
});

test('本次文档的本地链接及显式锚点有效', () => {
  for (const path of artifacts.filter((path) => path.endsWith('.md'))) {
    const text = withoutCode(read(path));
    for (const match of text.matchAll(/\[[^\]\n]+\]\(([^)\s]+)\)/g)) {
      if (/^(https?:|mailto:)/.test(match[1])) continue;
      assertReference(path, match[1]);
    }
    const ids = [...text.matchAll(/<a id="([^"]+)"><\/a>/g)].map((match) => match[1]);
    assert.equal(new Set(ids).size, ids.length, `锚点重复：${path}`);
  }
});

test('需求矩阵精确覆盖当前 PRD 的全部功能', () => {
  const expected = [...read('docs/product_docs/evalit_v001_prd.md').matchAll(/^### func_(\d+)_/gm)]
    .map((match) => `func_${match[1]}`).sort();
  assert.equal(expected.length, 20, 'PRD 功能范围变化后需同步更新本基线测试');
  const actual = matrix().features.map((feature) => feature.id).sort();
  assert.deepEqual(actual, expected);
});

test('需求及工程约束均能追踪到真实设计与可验收场景', () => {
  const cases = scenarios();
  const ids = new Set(cases.map((item) => item.id));
  assert.equal(ids.size, cases.length, '测试场景 ID 不可重复');
  const data = matrix();
  assert.equal(data.baseline.prd, 'docv_0.3');
  assert.equal(data.baseline.langfuse, 'cloud');
  assert.equal(data.productTestsStatus, 'specified_not_implemented');
  assert.deepEqual(data.engineering.map((item) => item.id).sort(),
    ['ENG-TDD', 'ENG-SECURITY', 'ENG-MIGRATION', 'ENG-RECOVERY', 'ENG-UI', 'ENG-COMPATIBILITY'].sort());
  const covered = new Set();
  for (const item of [...data.features, ...data.engineering]) {
    assert.ok(item.designs.length && item.tests.length, `追踪不完整：${item.id}`);
    for (const ref of item.designs) assertReference(`${base}traceability.json`, ref);
    for (const id of item.tests) {
      assert.ok(ids.has(id), `引用不存在场景：${item.id} -> ${id}`);
      covered.add(id);
    }
  }
  assert.deepEqual([...covered].sort(), [...ids].sort(), '每个场景须归属于产品需求或工程约束');
});

test('项目入口直接指向严格 TDD 规范', () => {
  const policyPath = 'docs/technical_docs/tdd_workflow.md';
  for (const path of ['README.md', 'AGENTS.md']) assert.ok(read(path).includes(policyPath), `${path} 未指向 TDD 规范`);
  for (const anchor of ['td-tdd-order', 'td-tdd-evidence', 'td-tdd-docs', 'td-tdd-gates', 'td-tdd-status']) {
    assertReference('README.md', `${policyPath}#${anchor}`);
  }
});

test('Trace metadata 关联不被替换为节点私有 metadata 或强制根节点规则', () => {
  assert.deepEqual(matrix().traceAssociation, {
    lookupScope: 'trace_metadata',
    observationSelection: 'after_trace_resolution',
    rootObservationRequired: false,
    observationPrivateMetadataFallback: false,
    adapterSemanticVerificationRequired: true,
  });
});

// 只核验设计契约已显式写出；这些断言不是产品实现测试。
function designSection(anchor) {
  const text = read(`${base}evalit_v001_technical_design.md`);
  const marker = `<a id="${anchor}"></a>`;
  assert.ok(text.includes(marker), `缺设计章节 ${anchor}`);
  return text.split(marker)[1].split('<a id=')[0];
}

function assertScenario(id, phrases) {
  const row = read(`${base}testing_strategy.md`).split('\n').find((line) => line.startsWith(`| ${id} |`));
  assert.ok(row, `缺少验收场景 ${id}`);
  for (const phrase of phrases) assert.ok(row.includes(phrase), `${id} 缺验收边界 ${phrase}`);
}

test('可选 body 未绑定与已绑定后缺值是两种不同契约', () => {
  const section = designSection('td-mapping');
  for (const phrase of ['可选 body 变量未绑定', '省略该属性', '已绑定但字段未命中', '完整 body']) {
    assert.ok(section.includes(phrase), `映射设计缺少 ${phrase}`);
  }
  assertScenario('TC-MAP-05', ['未绑定', 'not_evaluable', '零请求']);
});

test('试调用回执明确单向依赖而不由派生 Schema 使自身失效', () => {
  const section = designSection('td-http');
  for (const phrase of ['TransportReceipt', 'ParseReceipt', 'TraceReceipt', '不包含派生响应 Schema', '不重新调用 Agent']) {
    assert.ok(section.includes(phrase), `回执设计缺少 ${phrase}`);
  }
  assert.ok(!section.includes('绑定完整配置哈希'), '不能恢复包含派生结果的循环哈希');
  assertScenario('TC-HTTP-07', ['一次 Agent 请求', '两次', 'Trace']);
});

test('CAS 的 revision 与 epoch 归属独立阶段而非共享 case', () => {
  const section = designSection('td-storage');
  const stage = section.split('\n').find((line) => line.startsWith('| stage_attempts |'));
  for (const field of ['stage_revision', 'core_epoch', 'terminal_status']) assert.ok(stage.includes(field), `阶段表缺 ${field}`);
  assert.ok(section.includes('不能共用 case 级 stageRevision'));
  assertScenario('TC-RUN-06', ['并发', '重复', '一次']);
});

test('Main broker 控制创建、硬终止、退出确认与写者交接', () => {
  const section = designSection('td-architecture');
  for (const phrase of ['Main broker', 'coreEpoch', 'taskId', 'child handle', 'SIGKILL', 'exit']) {
    assert.ok(section.includes(phrase), `进程设计缺少 ${phrase}`);
  }
  assertScenario('TC-REC-04', ['旧 Core', 'exit', 'PID']);
});

test('产出引用提交先经过文件与目录持久化屏障', () => {
  const section = designSection('td-storage');
  for (const phrase of ['同卷', '目录同步', 'DB commit', 'ARTIFACT_CORRUPTED']) assert.ok(section.includes(phrase), `产出协议缺少 ${phrase}`);
  assertScenario('TC-REC-05', ['目录同步', '哈希', '无引用']);
});

test('numeric 平均值不采用会中间溢出的 Number 累加', () => {
  const section = designSection('td-export');
  for (const phrase of ['BigInt', '2^-1074', 'nearest-even', '1e308']) assert.ok(section.includes(phrase), `均值设计缺少 ${phrase}`);
  assertScenario('TC-MET-02', ['1e308', '相消', '次正规']);
});

test('平台相关 RED 与 GREEN 在同一目标平台重放并由可信门禁汇总', () => {
  const strategy = read(`${base}testing_strategy.md`);
  assert.ok(strategy.includes('tdd-replay-macos'));
  assert.ok(strategy.includes('相同 OS/架构/工具链'));
  assert.ok(read(`${base}tdd_workflow.md`).includes('平台证据缺失或 skip 不得通过'));
  assertScenario('TC-TDD-05', ['macOS', 'RED', 'GREEN']);
});

test('TS 编译前端不通过引用指令访问宿主文件系统', () => {
  const section = designSection('td-sandbox');
  for (const phrase of ['纯内存 CompilerHost', 'triple-slash', 'types: []', 'typeRoots: []', 'noResolve: true']) {
    assert.ok(section.includes(phrase), `编译期隔离缺少 ${phrase}`);
  }
  assertScenario('TC-SB-06', ['编译', 'canary', '零读取']);
});

test('target 不可用时连同未启动 Trace 一起收敛到终态', () => {
  assert.ok(designSection('td-run').includes('未执行 Trace'), '正常失败分支必须终止 Trace 占位');
  const recovery = designSection('td-recovery');
  assert.ok(recovery.includes('target 已 failed/not_evaluable'), '恢复要补齐已失败 target 的遗留依赖');
  assert.ok(recovery.includes('Trace queued/dispatched'), 'Trace 未开始与进行中都必须恢复收敛');
  assertScenario('TC-RUN-07', ['Trace', 'queued', '终态', '零']);
});

test('Agent IPC 使用分阶段结果与当前组合回执保存', () => {
  const section = designSection('td-ipc');
  const row = (command) => section.split('\n').find((line) => line.startsWith(`| ${command} |`));
  assert.ok(row('targets.testCall').includes('blocking/streaming'), 'SSE 传输阶段不能无条件推断 Schema');
  assert.ok(row('targets.generateParser') && row('targets.confirmParser'), '生成和确认必须有固定 IPC 方法');
  for (const command of ['targets.testTrace', 'targets.saveAgent']) {
    assert.ok(row(command).includes('validationReceiptId'), `${command} 需传递组合回执`);
    assert.ok(!row(command).includes('callReceiptId'), '不能仍要求旧式调用回执');
  }
  assertScenario('TC-IPC-03', ['SSE', '新链', '两次', '零']);
});
