const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../../..');
const dependency = createRequire(path.join(root, 'Frontend/package.json'));
const ts = dependency('typescript'), postcss = dependency('postcss');
const evidence = __dirname;
const baseline = JSON.parse(fs.readFileSync(path.join(evidence, 'baseline.json'), 'utf8'));
const allowed = new Set(baseline.authorized);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const base = 'Frontend/src/app/components/';
function read(relative, before = false) {
  return ts.createSourceFile(relative, fs.readFileSync(path.join(before ? path.join(evidence, 'source_before') : root, base + relative), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}
const printer = ts.createPrinter({ removeComments: true });
const print = (node, sf) => printer.printNode(ts.EmitHint.Unspecified, node, sf);
function find(sf, name) { return sf.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name); }
const oldPage = read('AreaInsights.tsx', true), newPage = read('AreaInsights.tsx');
const oldResults = read('areas/AreaResults.tsx', true), newResults = read('areas/AreaResults.tsx');
function controller(sf) { return find(sf, 'AreaInsights').body.statements.filter(n => !ts.isReturnStatement(n)).map(n => print(n, sf)); }
const controllerUnchanged = JSON.stringify(controller(oldPage)) === JSON.stringify(controller(newPage));
const unchangedHelpers = oldPage.statements.filter(n => ts.isFunctionDeclaration(n) && n.name?.text !== 'AreaInsights').map(n => ({ name: n.name.text, unchanged: print(n, oldPage) === print(find(newPage, n.name.text), newPage) }));
const distributionUnchanged = print(find(oldResults, 'AreaDistribution'), oldResults) === print(find(newResults, 'AreaDistribution'), newResults);
const axisTickUnchanged = print(find(oldResults, 'AreaAxisTick'), oldResults) === print(find(newResults, 'AreaAxisTick'), newResults);
function descendants(n, predicate) { const found = []; function visit(x) { if (predicate(x)) found.push(x); ts.forEachChild(x, visit); } visit(n); return found; }
function props(sf, name) {
  const node = descendants(sf, n => (ts.isJsxSelfClosingElement(n) || ts.isJsxOpeningElement(n)) && n.tagName.getText(sf) === name)[0];
  return node.attributes.properties.filter(p => p.name?.getText(sf) !== 'busy').map(p => print(p, sf));
}
const inputProps = ['AreaFilterPanel', 'AreaSummary', 'AreaDistribution', 'AreaDetails'].map(name => ({ name, unchanged: JSON.stringify(props(oldPage, name)) === JSON.stringify(props(newPage, name)) }));
function recommendations(sf) { return descendants(sf, n => ts.isConditionalExpression(n) && n.condition.getText(sf) === 'recommendations.length').map(n => print(n, sf)); }
const recommendationsUnchanged = JSON.stringify(recommendations(oldResults)) === JSON.stringify(recommendations(newResults));
function testCalls(sf) { return sf.statements.filter(n => ts.isExpressionStatement(n) && ts.isCallExpression(n.expression) && /^it(?:\.|\(|$)/.test(n.expression.getText(sf))).map(n => print(n, sf)); }
const oldTests = testCalls(read('AreaInsights.test.tsx', true)), newTests = new Set(testCalls(read('AreaInsights.test.tsx')));
const originalTestAssertionsUnchanged = oldTests.every(test => newTests.has(test));
const entries = Object.entries(baseline.files).map(([file, before]) => {
  const filename = path.join(root, file), after = fs.existsSync(filename) ? hash(fs.readFileSync(filename)) : null;
  return { file, before, after, unchanged: before === after, allowed: allowed.has(file) };
});
const unexpectedChanges = entries.filter(e => !e.allowed && !e.unchanged);
const backupHashesMatch = [...allowed].every(file => hash(fs.readFileSync(path.join(evidence, 'source_before', file))) === baseline.files[file]);
function sourceFiles(relative) { return fs.readdirSync(path.join(root, relative), { withFileTypes: true }).flatMap(e => e.isDirectory() ? sourceFiles(relative + '/' + e.name) : [relative + '/' + e.name]); }
const newSourceFiles = sourceFiles('Frontend/src').filter(file => !Object.hasOwn(baseline.files, file));
const afterHashes = [...allowed].map(file => ({ file, hash: hash(fs.readFileSync(path.join(root, file))) }));
const trailingWhitespace = afterHashes.flatMap(({ file }) => fs.readFileSync(path.join(root, file), 'utf8').split(/\r?\n/).flatMap((line, i) => /[\t ]+$/.test(line) ? [{ file, line: i + 1 }] : []));
const unscopedSelectors = [];
postcss.parse(fs.readFileSync(path.join(root, base, 'areas/AreaInsights.css'), 'utf8')).walkRules(rule => {
  for (const selector of rule.selectors) if (!selector.includes('.area-insights-workspace')) unscopedSelectors.push(selector);
});
const report = {
  controllerUnchanged, unchangedHelpers, distributionUnchanged, axisTickUnchanged, inputProps,
  recommendationsUnchanged, originalTestAssertionsUnchanged, originalTestDeclarations: oldTests.length,
  protectedFiles: entries.filter(e => !e.allowed).length, unexpectedChanges, backupHashesMatch,
  indexUnchanged: entries.find(e => e.file === '.git/index')?.unchanged,
  newSourceFiles, afterHashes, trailingWhitespace, unscopedSelectors,
  realDatabaseExcluded: baseline.realDatabaseExcluded,
  browserVerification: 'NOT VERIFIED; hierarchy assertions are DOM-only',
};
report.status = controllerUnchanged && unchangedHelpers.every(e => e.unchanged) && distributionUnchanged && axisTickUnchanged && inputProps.every(e => e.unchanged) && recommendationsUnchanged && originalTestAssertionsUnchanged && !unexpectedChanges.length && backupHashesMatch && report.indexUnchanged && !newSourceFiles.length && !trailingWhitespace.length && !unscopedSelectors.length ? 'PASS' : 'FAIL';
fs.writeFileSync(path.join(evidence, 'scope-and-contract-check.json'), JSON.stringify(report, null, 2) + '\n');
fs.writeFileSync(path.join(evidence, 'protected-hashes-after.json'), JSON.stringify({ entries }, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (report.status !== 'PASS') process.exitCode = 1;
