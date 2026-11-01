import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from '../../../Frontend/node_modules/typescript/lib/typescript.js';

const folder = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(folder, '../../..');
const beforeRoot = path.join(folder, 'source_before');
const printer = ts.createPrinter({ removeComments: true });
const files = [
  'DashboardOverview', 'SeasonalAnalysis', 'AgeAnalysis', 'AdvancedAnalytics', 'AreaInsights',
  'Forecast', 'WeatherRisk', 'ParentDiseaseVisibilitySettings', 'DataImport', 'Reports', 'Settings',
  'Account', 'NotificationsPanel', 'PermissionsPage', 'medical-knowledge/MedicalKnowledgeResearchPage',
  'medical-knowledge/AutoMedicalKnowledgePanel', 'admin/permissions/PermissionControls',
];
function extract(text) {
  const source = ts.createSourceFile('source.tsx', text.replace(/\r\n/g, '\n'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const print = (node) => printer.printNode(ts.EmitHint.Unspecified, node, source);
  const domainFunctions = new Set();
  for (const node of source.statements) {
    if (!ts.isImportDeclaration(node) || !/lib\/(api|medicalKnowledgeApi|importJobs|reports)/.test(node.moduleSpecifier.text)) continue;
    const bindings = node.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) bindings.elements.forEach((entry) => domainFunctions.add(entry.name.text));
  }
  const result = { hooks: [], domainCalls: [], fieldsAndEvents: [], handlers: [] };
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(source);
      if (/^use(State|Effect|Memo|Callback|Ref)$/.test(callee)) result.hooks.push(print(node));
      if (/^api\./.test(callee) || domainFunctions.has(callee)) result.domainCalls.push(print(node));
    }
    if (ts.isFunctionDeclaration(node) && node.body && /^(handle|runPredict|resetResult|locateCurrentPosition)/.test(node.name?.text ?? '')) result.handlers.push(print(node.body));
    if (ts.isJsxAttribute(node) && /^(on[A-Z].*|value|checked|disabled|required|multiple|accept|type|ref)$/.test(node.name.getText(source))) {
      const tag = node.parent.parent.tagName?.getText(source);
      const chartType = node.name.getText(source) === 'type' && !['input', 'button', 'select', 'textarea'].includes(tag);
      if (tag !== 'StatCard' && tag !== 'AdminStatCard' && !chartType) result.fieldsAndEvents.push(print(node));
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return result;
}
const bag = (values) => JSON.stringify([...values].sort());
const results = files.map((name) => {
  const file = `Frontend/src/app/components/${name}.tsx`;
  const before = extract(fs.readFileSync(path.join(beforeRoot, file), 'utf8'));
  const after = extract(fs.readFileSync(path.join(root, file), 'utf8'));
  // Audited label correction only: forecast.length is result rows, not run count.
  if (name === 'DashboardOverview') before.hooks = before.hooks.map((text) => text.replace("t('dashboard.forecastRuns')", "t('content.forecastRows')"));
  return { file, checks: Object.fromEntries(Object.keys(before).map((key) => [key, bag(before[key]) === bag(after[key])])) };
});
const pass = results.every(({ checks }) => Object.values(checks).every(Boolean));
const output = { pass, results, limitations: 'Static source parity for state, requests, input handlers and payloads. Excludes chart presentation and metric props; does not prove browser layout or all runtime interactions.' };
fs.writeFileSync(path.join(folder, 'content_contract.json'), JSON.stringify(output, null, 2));
console.log(JSON.stringify(output, null, 2));
if (!pass) process.exitCode = 1;
