const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../../..');
const dependency = createRequire(path.join(root, 'Frontend/package.json'));
const ts = dependency('typescript'), postcss = dependency('postcss');
const base = 'Frontend/src/app/components/';
const allowed = new Set(['SeasonalAnalysis.tsx', 'admin/SeasonalCharts.tsx', 'advanced-analytics/MonthlyWorkspace.tsx', 'advanced-analytics/TrendWorkspace.tsx', 'advanced-analytics/AnalyticsControls.tsx', 'advanced-analytics/TrendInteractions.tsx'].map(f => base + f));
const expectedNew = new Set(['ClientPagination.tsx', 'refinement.css', 'ClientPagination.test.tsx', 'Usability.regression.test.tsx'].map(f => base + 'analytics-usability/' + f));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'baseline.json'), 'utf8'));
const entries = Object.entries(baseline.files).map(([file, before]) => {
  const filename = path.join(root, file), after = fs.existsSync(filename) ? hash(fs.readFileSync(filename)) : null;
  return { file, before, after, unchanged: before === after, allowed: allowed.has(file) };
});
const unexpectedChanges = entries.filter(e => !e.allowed && !e.unchanged);
const backupHashesMatch = [...allowed].every(file => hash(fs.readFileSync(path.join(__dirname, 'source_before', file))) === baseline.files[file]);
const printer = ts.createPrinter({ removeComments: true });
function source(file, before = false) {
  return ts.createSourceFile(file, fs.readFileSync(path.join(before ? path.join(__dirname, 'source_before') : root, base + file), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}
function findFunction(sf, name) { return sf.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name); }
function print(n, sf) { return printer.printNode(ts.EmitHint.Unspecified, n, sf); }
function walk(n, predicate) { const found = []; function visit(x) { if (predicate(x)) found.push(x); ts.forEachChild(x, visit); } visit(n); return found; }
function sameFunction(file, name) { const a = source(file, true), b = source(file); return print(findFunction(a, name), a) === print(findFunction(b, name), b); }
const oldSeasonal = source('SeasonalAnalysis.tsx', true), newSeasonal = source('SeasonalAnalysis.tsx');
function controller(sf) { return findFunction(sf, 'SeasonalAnalysis').body.statements.filter(n => !ts.isReturnStatement(n)).map(n => print(n, sf)); }
const seasonalControllerUnchanged = JSON.stringify(controller(oldSeasonal)) === JSON.stringify(controller(newSeasonal));
const plotTags = new Set(['ResponsiveContainer', 'LineChart', 'Line', 'BarChart', 'Bar', 'PieChart', 'Pie', 'Cell', 'Tooltip', 'XAxis', 'YAxis', 'CartesianGrid']);
function plotProps(sf) {
  return walk(sf, n => (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && plotTags.has(n.tagName.getText(sf)))
    .map(n => ({ tag: n.tagName.getText(sf), props: print(n.attributes, sf) }));
}
const chartProps = ['SeasonalAnalysis.tsx', 'admin/SeasonalCharts.tsx', 'advanced-analytics/MonthlyWorkspace.tsx', 'advanced-analytics/TrendWorkspace.tsx']
  .map(file => ({ file, unchanged: JSON.stringify(plotProps(source(file, true))) === JSON.stringify(plotProps(source(file))) }));
const sharedFunctions = [
  ['advanced-analytics/AnalyticsControls.tsx', 'PeriodCombobox'],
  ['advanced-analytics/AnalyticsControls.tsx', 'DiseaseCombobox'],
  ['advanced-analytics/TrendInteractions.tsx', 'TrendLineTooltip'],
  ['advanced-analytics/TrendInteractions.tsx', 'TrendPointDot'],
].map(([file, name]) => ({ file, name, unchanged: sameFunction(file, name) }));
function filesIn(relative) { return fs.readdirSync(path.join(root, relative), { withFileTypes: true }).flatMap(e => e.isDirectory() ? filesIn(relative + '/' + e.name) : [relative + '/' + e.name]); }
const newFiles = filesIn('Frontend/src').filter(file => !Object.hasOwn(baseline.files, file));
const unexpectedNew = newFiles.filter(file => !expectedNew.has(file));
const missingNew = [...expectedNew].filter(file => !fs.existsSync(path.join(root, file)));
const sourceAfterHashes = [...allowed, ...expectedNew].map(file => ({ file, hash: hash(fs.readFileSync(path.join(root, file))) }));
const trailingWhitespace = sourceAfterHashes.flatMap(({ file }) => fs.readFileSync(path.join(root, file), 'utf8').split(/\r?\n/).flatMap((line, i) => /[\t ]+$/.test(line) ? [{ file, line: i + 1 }] : []));
const css = fs.readFileSync(path.join(root, base, 'analytics-usability/refinement.css'), 'utf8');
const unscoped = [];
postcss.parse(css).walkRules(rule => { for (const selector of rule.selectors) if (!/\.(admin-seasonal-content|analytics-mode-monthly|analytics-mode-trend)\b/.test(selector)) unscoped.push(selector); });
const report = {
  seasonalControllerUnchanged, chartProps, sharedFunctions,
  protectedFiles: entries.filter(e => !e.allowed).length, unexpectedChanges,
  backupHashesMatch, indexUnchanged: entries.find(e => e.file === '.git/index')?.unchanged,
  newFiles, unexpectedNew, missingNew, unscoped, trailingWhitespace, sourceAfterHashes,
  cssOnlyChecks: 'Source checks only; not browser layout verification',
  realDatabaseExcluded: baseline.realDatabaseExcluded,
};
report.status = seasonalControllerUnchanged && chartProps.every(x => x.unchanged) && sharedFunctions.every(x => x.unchanged) && !unexpectedChanges.length && backupHashesMatch && report.indexUnchanged && !unexpectedNew.length && !missingNew.length && !unscoped.length && !trailingWhitespace.length ? 'PASS' : 'FAIL';
fs.writeFileSync(path.join(__dirname, 'scope-and-contract-check.json'), JSON.stringify(report, null, 2) + '\n');
fs.writeFileSync(path.join(__dirname, 'protected-hashes-after.json'), JSON.stringify({ entries }, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (report.status !== 'PASS') process.exitCode = 1;
