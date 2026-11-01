const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../../..');
const dependency = createRequire(path.join(root, 'Frontend/package.json'));
const ts = dependency('typescript'), postcss = dependency('postcss');
const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'baseline.json'), 'utf8'));
const allowed = new Set(baseline.authorized);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const page = 'Frontend/src/app/components/AreaInsights.tsx';
const cssFile = 'Frontend/src/app/components/areas/AreaInsights.css';
const testFile = 'Frontend/src/app/components/AreaInsights.test.tsx';
function source(file, before = false) { return ts.createSourceFile(file, fs.readFileSync(path.join(before ? path.join(__dirname, 'source_before') : root, file), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX); }
const printer = ts.createPrinter({ removeComments: true });
const print = (n, sf) => printer.printNode(ts.EmitHint.Unspecified, n, sf);
const find = (sf, name) => sf.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name);
const oldPage = source(page, true), newPage = source(page);
const controller = sf => find(sf, 'AreaInsights').body.statements.filter(n => !ts.isReturnStatement(n)).map(n => print(n, sf));
const controllerUnchanged = JSON.stringify(controller(oldPage)) === JSON.stringify(controller(newPage));
const helpers = oldPage.statements.filter(n => ts.isFunctionDeclaration(n) && !['AreaInsights', 'Empty'].includes(n.name?.text)).map(n => ({ name: n.name.text, unchanged: print(n, oldPage) === print(find(newPage, n.name.text), newPage) }));
function walk(n, predicate) { const found = []; function visit(x) { if (predicate(x)) found.push(x); ts.forEachChild(x, visit); } visit(n); return found; }
function props(sf, name) {
  const n = walk(sf, n => ts.isJsxSelfClosingElement(n) && n.tagName.getText(sf) === name)[0];
  return n.attributes.properties.filter(p => p.name?.getText(sf) !== 'recommendationEmpty').map(p => print(p, sf));
}
const unchangedDataProps = ['AreaFilterPanel', 'AreaSummary', 'AreaDistribution', 'AreaDetails'].map(name => ({ name, unchanged: JSON.stringify(props(oldPage, name)) === JSON.stringify(props(newPage, name)) }));
const calls = sf => sf.statements.filter(n => ts.isExpressionStatement(n) && ts.isCallExpression(n.expression) && /^it(?:\.|\(|$)/.test(n.expression.getText(sf))).map(n => print(n, sf));
const originalTests = calls(source(testFile, true)), currentTests = new Set(calls(source(testFile)));
const originalTestsUnchanged = originalTests.every(t => currentTests.has(t));
function cssRules(before) {
  const parsed = postcss.parse(fs.readFileSync(path.join(before ? path.join(__dirname, 'source_before') : root, cssFile), 'utf8'));
  const rules = new Map(); parsed.walkRules(rule => { rules.set(rule.selector, rule.nodes.filter(n => n.type === 'decl').map(n => `${n.prop}:${n.value}:${Boolean(n.important)}`).join(';')); }); return rules;
}
const oldRules = cssRules(true), newRules = cssRules(false);
const changedRules = [...oldRules].filter(([key, value]) => newRules.get(key) !== value).map(([key]) => key);
const addedRules = [...newRules.keys()].filter(key => !oldRules.has(key));
const cssChangesInScope = changedRules.every(key => ['.area-insights-workspace .area-detail-workspace', '.area-insights-workspace .area-recommendations'].includes(key)) && addedRules.every(key => key === '.area-insights-workspace .area-empty-message');
const entries = Object.entries(baseline.files).map(([file, before]) => {
  const filename = path.join(root, file), after = fs.existsSync(filename) ? hash(fs.readFileSync(filename)) : null;
  return { file, before, after, allowed: allowed.has(file), unchanged: before === after };
});
const unexpectedChanges = entries.filter(e => !e.allowed && !e.unchanged);
const backupsMatch = [...allowed].every(file => hash(fs.readFileSync(path.join(__dirname, 'source_before', file))) === baseline.files[file]);
function sources(relative) { return fs.readdirSync(path.join(root, relative), { withFileTypes: true }).flatMap(e => e.isDirectory() ? sources(relative + '/' + e.name) : [relative + '/' + e.name]); }
const newSourceFiles = sources('Frontend/src').filter(file => !Object.hasOwn(baseline.files, file));
const afterHashes = [...allowed].map(file => ({ file, hash: hash(fs.readFileSync(path.join(root, file))) }));
const trailingWhitespace = afterHashes.flatMap(({ file }) => fs.readFileSync(path.join(root, file), 'utf8').split(/\r?\n/).flatMap((line, i) => /[\t ]+$/.test(line) ? [{ file, line: i + 1 }] : []));
const report = { controllerUnchanged, helpers, unchangedDataProps, originalTestsUnchanged, changedRules, addedRules, cssChangesInScope, protectedFiles: entries.filter(e => !e.allowed).length, unexpectedChanges, backupsMatch, indexUnchanged: entries.find(e => e.file === '.git/index')?.unchanged, newSourceFiles, trailingWhitespace, afterHashes, realDatabaseExcluded: true };
report.status = controllerUnchanged && helpers.every(h => h.unchanged) && unchangedDataProps.every(p => p.unchanged) && originalTestsUnchanged && cssChangesInScope && !unexpectedChanges.length && backupsMatch && report.indexUnchanged && !newSourceFiles.length && !trailingWhitespace.length ? 'PASS' : 'FAIL';
fs.writeFileSync(path.join(__dirname, 'scope-and-contract-check.json'), JSON.stringify(report, null, 2) + '\n');
fs.writeFileSync(path.join(__dirname, 'protected-hashes-after.json'), JSON.stringify({ entries }, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (report.status !== 'PASS') process.exitCode = 1;
