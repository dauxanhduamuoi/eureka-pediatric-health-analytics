// Read-only checks against this task's actual working-tree snapshot.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../../..');
const frontendRequire = createRequire(path.join(root, 'Frontend/package.json'));
const ts = frontendRequire('typescript');
const postcss = frontendRequire('postcss');
const printer = ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed });
const componentPath = 'Frontend/src/app/components/';
const originalFiles = ['DataImport.tsx', 'DiseaseCodesManager.tsx', 'ProvinceRegionsManager.tsx', 'ParentGuideManager.tsx'];
const authorized = new Set(originalFiles.map(f => componentPath + f));
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
function source(relative, before = false) {
  const filename = path.join(before ? path.join(__dirname, 'source_before') : root, relative);
  return ts.createSourceFile(relative, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}
function findFunction(sf, name) {
  return sf.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name);
}
function descendants(node, predicate) {
  const result = [];
  function visit(n) { if (predicate(n)) result.push(n); ts.forEachChild(n, visit); }
  visit(node);
  return result;
}
function text(n, sf) { return printer.printNode(ts.EmitHint.Unspecified, n, sf); }
function controlStatements(fn, sf) {
  let effect = 0;
  const result = new Map();
  for (const statement of fn.body.statements) {
    if (ts.isReturnStatement(statement) || descendants(statement, n => ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)).length) continue;
    const key = ts.isVariableStatement(statement)
      ? statement.declarationList.declarations.map(d => d.name.getText(sf).replace(/\s/g, '')).join(',')
      : `effect:${++effect}`;
    result.set(key, text(statement, sf));
  }
  return result;
}
function apiCalls(fn, sf) {
  return descendants(fn, n => ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.expression.getText(sf) === 'api')
    .map(n => text(n, sf)).sort();
}
const hooks = source(componentPath + 'data-management/useCatalogManagers.ts');
const rules = [
  ['DataImport.tsx', 'DataImport', ['loadImportStatuses', 'effect:1'], ['[statusError,setStatusError]', '[jobError,setJobError]']],
  ['DiseaseCodesManager.tsx', 'useDiseaseCodesManager', ['load', 'effect:2'], ['listVersion']],
  ['ProvinceRegionsManager.tsx', 'useProvinceRegionsManager', [], []],
  ['ParentGuideManager.tsx', 'useParentGuideManager', ['loadImportedRows'], ['guideListVersion']],
];
const controllers = rules.map(([file, hook, allowedChanges, allowedAdditions]) => {
  const before = source(componentPath + file, true);
  const after = file === 'DataImport.tsx' ? source(componentPath + file) : hooks;
  const oldFn = findFunction(before, file.replace('.tsx', ''));
  const newFn = findFunction(after, hook);
  if (!oldFn || !newFn) throw new Error(`Missing controller: ${file}`);
  const oldParts = controlStatements(oldFn, before), newParts = controlStatements(newFn, after);
  const changes = [...oldParts].filter(([k, v]) => newParts.get(k) !== v).map(([k]) => k);
  const additions = [...newParts.keys()].filter(k => !oldParts.has(k));
  const unexpected = changes.filter(k => !allowedChanges.includes(k)).concat(additions.filter(k => !allowedAdditions.includes(k)));
  const apiUnchanged = JSON.stringify(apiCalls(oldFn, before)) === JSON.stringify(apiCalls(newFn, after));
  return { file, originalStatements: oldParts.size, unchangedStatements: oldParts.size - changes.length, changes, additions, unexpected, apiCallsUnchanged: apiUnchanged };
});
const beforeGuides = source(componentPath + 'ParentGuideManager.tsx', true);
const afterGuides = source(componentPath + 'data-management/GuidesWorkspace.tsx');
function guideMapping(sf) {
  const obj = descendants(sf, n => ts.isObjectLiteralExpression(n) && n.properties.some(p => p.name?.getText(sf) === 'TENNHOMICD'))[0];
  // Compare property names and value expressions; the object printer preserves
  // the source's one-line/multiline flag, which is presentation only.
  return obj && JSON.stringify(obj.properties.map(p => ({ name: p.name.getText(sf), value: text(p.initializer, sf) })));
}
const guideContentMappingUnchanged = guideMapping(beforeGuides) === guideMapping(afterGuides);
const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'baseline.json'), 'utf8'));
const backupHashesMatch = [...authorized].every(file => hash(fs.readFileSync(path.join(__dirname, 'source_before', file))) === baseline.files[file]);
const expectedNewSources = new Set([
  'DataImport.test.tsx',
  ...['useCatalogManagers.ts', 'ImportWorkspace.tsx', 'DiseaseCodesWorkspace.tsx', 'RegionsWorkspace.tsx', 'GuidesWorkspace.tsx', 'ManagementParts.tsx', 'data-management.css', 'DataManagers.test.tsx', 'DataManagement.navigation.test.tsx'].map(f => 'data-management/' + f),
].map(f => componentPath + f));
function walk(relative) {
  return fs.readdirSync(path.join(root, relative), { withFileTypes: true }).flatMap(e => {
    const file = relative + '/' + e.name;
    return e.isDirectory() ? walk(file) : [file];
  });
}
const newSources = walk('Frontend/src').filter(file => !Object.hasOwn(baseline.files, file));
const unexpectedNewSources = newSources.filter(file => !expectedNewSources.has(file));
const missingNewSources = [...expectedNewSources].filter(file => !fs.existsSync(path.join(root, file)));
const changedSourceHashes = [...authorized, ...expectedNewSources].map(file => ({ file, hash: hash(fs.readFileSync(path.join(root, file))) }));
const trailingWhitespace = changedSourceHashes.flatMap(({ file }) => fs.readFileSync(path.join(root, file), 'utf8').split(/\r?\n/).flatMap((line, index) => /[\t ]+$/.test(line) ? [{ file, line: index + 1 }] : []));
const entries = Object.entries(baseline.files).map(([file, before]) => {
  const filename = path.join(root, file), after = fs.existsSync(filename) ? hash(fs.readFileSync(filename)) : null;
  return { file, before, after, authorized: authorized.has(file), unchanged: before === after };
});
const unexpectedChanges = entries.filter(e => !e.authorized && !e.unchanged);
fs.writeFileSync(path.join(__dirname, 'protected-hashes-after.json'), JSON.stringify({ total: entries.length, protected: entries.filter(e => !e.authorized).length, unexpectedChanges, entries }, null, 2) + '\n');
const css = fs.readFileSync(path.join(root, componentPath, 'data-management/data-management.css'), 'utf8');
const unscopedSelectors = [];
postcss.parse(css).walkRules(rule => {
  for (const selector of rule.selectors) if (!selector.startsWith('.data-management-scope')) unscopedSelectors.push(selector);
});
const report = {
  controllers, guideContentMappingUnchanged, unscopedSelectors, backupHashesMatch,
  newSources, unexpectedNewSources, missingNewSources, changedSourceHashes, trailingWhitespace,
  protectedFiles: entries.length - authorized.size, unexpectedChanges,
  indexUnchanged: entries.find(e => e.file === '.git/index')?.unchanged,
  realDatabaseExcludedFromHashInventory: baseline.realDatabaseExcluded,
};
const ok = controllers.every(c => !c.unexpected.length && c.apiCallsUnchanged) && guideContentMappingUnchanged && !unexpectedChanges.length && !unscopedSelectors.length && report.indexUnchanged && backupHashesMatch && !unexpectedNewSources.length && !missingNewSources.length && !trailingWhitespace.length;
report.status = ok ? 'PASS' : 'FAIL';
fs.writeFileSync(path.join(__dirname, 'contract-and-scope-check.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (!ok) process.exitCode = 1;
