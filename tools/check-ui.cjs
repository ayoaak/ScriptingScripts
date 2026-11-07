const ts = require('typescript');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../Battlefield1Stats');
let failures = 0;
let count = 0;
function visit(dir) {
  for (const name of fs.readdirSync(dir)) {
    const file = path.join(dir, name);
    if (fs.statSync(file).isDirectory()) { visit(file); continue; }
    if (!/\.tsx?$/.test(file)) continue;
    const source = fs.readFileSync(file, 'utf8');
    const result = ts.transpileModule(source, {
      fileName: file, reportDiagnostics: true,
      compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.Preserve, isolatedModules: true },
    });
    for (const diagnostic of result.diagnostics || []) {
      if (diagnostic.category === ts.DiagnosticCategory.Error) {
        failures++; console.error(file, ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
      }
    }
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    for (const node of ast.statements) {
      if (!ts.isImportDeclaration(node) || !node.moduleSpecifier.text.startsWith('.')) continue;
      const target = path.resolve(path.dirname(file), node.moduleSpecifier.text);
      if (!['.ts', '.tsx', '/index.ts', '/index.tsx'].some(ext => fs.existsSync(target + ext))) {
        failures++; console.error('Missing local module:', target);
      }
    }
    count++;
  }
}
visit(root);
if (failures) process.exit(1);
console.log(`Checked syntax and local imports: ${count} TS/TSX files. Native Scripting typings/device validation remains separate.`);
