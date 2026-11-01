const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = process.cwd();
const ts = require(path.join(root, 'Frontend/node_modules/typescript'));
const postcss = require(path.join(root, 'Frontend/node_modules/postcss'));
const ev = __dirname;
const oldEntry = 'Frontend/src/app/components/AgeAnalysis.tsx';
const base = JSON.parse(fs.readFileSync(path.join(ev, 'baseline.json'), 'utf8'));
const allowedChanged = ['Frontend/src/app/AppPages.tsx', 'Frontend/src/app/components/admin/ChartVisuals.test.tsx', 'Frontend/src/app/components/admin/AdminPages.regression.test.tsx'];
const changed = [], missing = [], outsideChanges = [];
for (const [file, expected] of Object.entries(base.files)) {
  if (!fs.existsSync(path.join(root, file))) { missing.push(file); continue; }
  const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
  if (actual !== expected) { changed.push(file); if (!allowedChanged.includes(file)) outsideChanges.push(file); }
}
const parse = (s) => ts.createSourceFile('input.tsx', s, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const before = parse(fs.readFileSync(path.join(ev, 'source_before', oldEntry), 'utf8'));
const after = parse(fs.readFileSync(path.join(root, 'Frontend/src/app/components/age-insights/useAgeInsights.ts'), 'utf8'));
const printer = ts.createPrinter({ removeComments: true });
const text = (n, s) => printer.printNode(ts.EmitHint.Unspecified, n, s);
const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const helpers = ['AgeAnalysisCacheState', 'toNumberOrUndefined', 'normalizeSearchText', 'matchesDiseaseSearch'];
const helperSame = helpers.every((name) => equal(...[before, after].map((s) => text(s.statements.find((n) => n.name?.text === name), s))));
const main = (s) => s.statements.find((n) => ts.isFunctionDeclaration(n) && ['AgeAnalysis', 'useAgeInsights'].includes(n.name?.text));
const derivedNames = ['ageRangeLabel', 'periodLabel', 'chartRows', 'filteredRows', 'noAgeRowsLabel', 'noAgeChartLabel', 'showEmptyLoading'];
const variables = (s) => main(s).body.statements.filter(ts.isVariableStatement).flatMap((n) => [...n.declarationList.declarations]);
const derivedSame = derivedNames.every((name) => equal(...[before, after].map((s) => text(variables(s).find((n) => n.name.getText(s) === name), s))));
const stateNodes = (s) => variables(s).filter((n) => n.initializer && ts.isCallExpression(n.initializer) && n.initializer.expression.getText(s) === 'useState').map((n) => text(n, s));
const calls = (s, match) => { const list = []; const walk = (n) => { if (ts.isCallExpression(n) && match(n.expression.getText(s))) list.push(text(n, s)); ts.forEachChild(n, walk); }; walk(s); return list; };
const apiCallsSame = equal(calls(before, (n) => n.startsWith('api.')), calls(after, (n) => n.startsWith('api.')));
const cacheCallsSame = equal(calls(before, (n) => /^(load|save)ChartDataCache$/.test(n)), calls(after, (n) => /^(load|save)ChartDataCache$/.test(n)));
const consumersMatch = allowedChanged.every((file) => {
  let old = fs.readFileSync(path.join(ev, 'source_before', file), 'utf8');
  old = old.replace("import('./components/AgeAnalysis')", "import('./components/age-insights/AgeInsightsWorkspace')").replace("from '../AgeAnalysis'", "from '../age-insights/AgeInsightsWorkspace'").replaceAll('AgeAnalysis', 'AgeInsightsWorkspace');
  return old === fs.readFileSync(path.join(root, file), 'utf8');
});
const css = postcss.parse(fs.readFileSync(path.join(root, 'Frontend/src/app/components/age-insights/AgeInsights.css'), 'utf8'));
let scoped = true; let ruleCount = 0;
css.walkRules((rule) => { ruleCount += 1; if (rule.selectors.some((selector) => !selector.includes('.age-insights-workspace'))) scoped = false; });
const result = {
  protectedFileCount: Object.keys(base.files).length,
  changedExistingFiles: changed, removedExistingFiles: missing, outsideAllowedChanges: outsideChanges,
  removalOnlyExpected: equal(missing, [oldEntry]),
  oldEntryBackupMatchesBaseline: crypto.createHash('sha256').update(fs.readFileSync(path.join(ev, 'source_before', oldEntry))).digest('hex') === base.files[oldEntry],
  helpersAndCacheTypeUnchanged: helperSame,
  derivedLabelsChartAndSearchUnchanged: derivedSame,
  originalStateInitializersUnchanged: equal(stateNodes(before), stateNodes(after)),
  apiCallExpressionsUnchanged: apiCallsSame, cacheCallExpressionsAndObjectsUnchanged: cacheCallsSame,
  consumerEditsOnlyEntryMigration: consumersMatch,
  cssRulesScopedToAgePage: scoped, cssRuleCount: ruleCount,
  intentionalBehaviorCorrections: ['Latest-request version guard and unmount cleanup', 'Clear pending state when the current range is invalid', 'Do not display missing peak counts as zero'],
  realDatabaseIncludedInHashInventory: false,
};
fs.writeFileSync(path.join(ev, 'source-preservation.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
if (outsideChanges.length || !result.removalOnlyExpected || !result.oldEntryBackupMatchesBaseline || !helperSame || !derivedSame || !result.originalStateInitializersUnchanged || !apiCallsSame || !cacheCallsSame || !consumersMatch || !scoped) process.exitCode = 1;
