const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const root = path.resolve(__dirname, '../CFUsage');
const cache = new Map();
let d1Response;
let lastD1Query;
const h = (type, props, ...children) => ({ type, props: { ...props, children } });
async function graphql(token, query) {
  if (query.includes('d1AnalyticsAdaptiveGroups')) {
    lastD1Query = query;
    return d1Response;
  }
  if (query.includes('pagesFunctions')) return { ok: true, value: { viewer: { accounts: [{ pages: [] }] } } };
  return { ok: true, value: { viewer: { accounts: [{ byDay: [], byHour: [] }] } } };
}
function load(file) {
  file = path.resolve(file);
  if (!path.extname(file)) file += fs.existsSync(file + '.ts') ? '.ts' : '.tsx';
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} }; cache.set(file, mod);
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    fileName: file, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, jsxFactory: 'h' }
  }).outputText;
  vm.runInNewContext(source, {
    exports: mod.exports, module: mod, h, Device: { systemLocale: 'zh' },
    require(name) {
      if (name === 'scripting') return new Proxy({}, { get: (_, key) => key });
      if (name === './cloudflare') return { graphql };
      return load(path.resolve(path.dirname(file), name));
    }
  }, { filename: file });
  return mod.exports;
}
let count = 0;
function syntax(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, e.name);
    if (e.isDirectory()) { syntax(file); continue; }
    if (!/\.tsx?$/.test(file)) continue;
    const source = fs.readFileSync(file, 'utf8');
    const result = ts.transpileModule(source, { fileName: file, reportDiagnostics: true, compilerOptions: { jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } });
    assert.equal((result.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error).length, 0, file);
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    for (const n of ast.statements) if (ts.isImportDeclaration(n) && n.moduleSpecifier.text.startsWith('.')) {
      const target = path.resolve(path.dirname(file), n.moduleSpecifier.text);
      assert.ok(['.ts', '.tsx', '/index.ts', '/index.tsx'].some(ext => fs.existsSync(target + ext)), target);
    }
    count++;
  }
}
(async () => {
  syntax(root);
  const { d1MetersFor, sumD1 } = load(path.join(root, 'd1'));
  const { periodFor } = load(path.join(root, 'limits'));
  const now = Date.parse('2026-11-13T12:00:00Z');
  const profile = { id: 'test', accountId: 'account', plan: 'free', billingDay: 15 };
  const p = periodFor(profile, now);
  const snapshot = { periodStart: p.start, periodEnd: p.end, d1: { rowsRead: 2500000, rowsWritten: 90000 } };
  const meters = d1MetersFor(profile, snapshot, now);
  assert.equal(meters.read.ratio, 0.5);
  assert.equal(meters.write.ratio, 0.9);
  assert.equal(d1MetersFor(profile, snapshot, p.end), null);
  assert.equal(d1MetersFor(profile, { ...snapshot, d1: undefined }, now), null);
  assert.equal(d1MetersFor(profile, { ...snapshot, d1: { rowsRead: NaN, rowsWritten: 0 } }, now), null);
  assert.equal(sumD1([]).rowsRead, 0);
  assert.equal(sumD1([{ sum: { rowsRead: 1 } }]), undefined);
  assert.equal(sumD1([{ sum: { rowsRead: 1, rowsWritten: 2 } }, { sum: { rowsRead: 3, rowsWritten: 5 } }]).rowsWritten, 7);
  const paid = { ...profile, plan: 'paid' };
  const paidPeriod = periodFor(paid, now);
  const paidMeters = d1MetersFor(paid, { periodStart: paidPeriod.start, periodEnd: paidPeriod.end, d1: { rowsRead: 25e9, rowsWritten: 60e6 } }, now);
  assert.equal(paidMeters.read.ratio, 1);
  assert.equal(paidMeters.write.ratio, 1.2);
  const { D1Ring } = load(path.join(root, 'components/D1Ring'));
  const tree = D1Ring({ meters, size: 72 });
  const [outer, inner] = tree.props.children;
  assert.equal(outer.props.ratio, 0.5);
  assert.equal(inner.props.ratio, 0.9);
  assert.ok(outer.props.size > inner.props.size);
  assert.equal(outer.props.color, 'systemBlue');
  assert.equal(inner.props.color, 'systemPurple');
  const { UsageRing } = load(path.join(root, 'components/UsageRing'));
  assert.equal(UsageRing({ ratio: 1.2, size: 72, lineWidth: 6 }).props.children[1].props.trim.to, 1);
  assert.equal(UsageRing({ ratio: 0, size: 72, lineWidth: 6 }).props.children[1].props.trim.to, 0);
  const { fetchSnapshot } = load(path.join(root, 'api/usage'));
  const success = rows => ({ ok: true, value: { viewer: { accounts: [{ d1: rows }] } } });
  d1Response = success([{ sum: { rowsRead: 321, rowsWritten: 12 } }]);
  let result = await fetchSnapshot(profile, 'test-token', now);
  assert.equal(result.value.d1.rowsRead, 321);
  assert.equal(result.value.d1.rowsWritten, 12);
  assert.ok(lastD1Query.includes('2026-11-13'));
  d1Response = success([]);
  result = await fetchSnapshot(profile, 'test-token', now);
  assert.equal(result.value.d1.rowsRead, 0);
  d1Response = { ok: false, reason: 'api', message: 'permission denied' };
  result = await fetchSnapshot(profile, 'test-token', now);
  assert.equal(result.ok, true);
  assert.equal(result.value.d1, undefined);
  assert.ok(result.value.warnings.includes('d1'));
  d1Response = success([{ sum: { rowsRead: 123 } }]);
  result = await fetchSnapshot(profile, 'test-token', now);
  assert.equal(result.value.d1, undefined);
  d1Response = success([]);
  await fetchSnapshot(paid, 'test-token', now);
  assert.ok(lastD1Query.includes('2026-10-15'));
  console.log(`CF Usage: ${count} TS/TSX files checked; D1 quotas, reset, API fallback, and ring mapping passed. Native rendering still needs device validation.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
