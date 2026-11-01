import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from '../../Frontend/node_modules/typescript/lib/typescript.js';

const folder = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(folder, '../..');
const beforeRoot = path.join(folder, 'source_before');
const printer = ts.createPrinter({ removeComments: true });
const charts = new Set(['ResponsiveContainer', 'AreaChart', 'Area', 'BarChart', 'Bar', 'LineChart', 'Line', 'PieChart', 'Pie', 'XAxis', 'YAxis', 'CartesianGrid', 'Tooltip', 'Legend', 'LabelList', 'Cell']);
function readContract(file) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const result = { hooks: [], actions: [], fieldsAndEvents: [], chartStructure: [] };
  const print = (node) => printer.printNode(ts.EmitHint.Unspecified, node, source);
  function visit(node) {
    if (ts.isCallExpression(node) && /^use(State|Effect|Memo|Callback|Ref)$/.test(node.expression.getText(source))) result.hooks.push(print(node));
    if (ts.isFunctionDeclaration(node) && /^handle[A-Z]/.test(node.name?.text ?? '')) result.actions.push(print(node));
    if (ts.isJsxAttribute(node) && /^(on[A-Z].*|value|checked|disabled|required|multiple|accept|type|ref)$/.test(node.name.getText(source))) {
      // A KPI value moved from a text node into a presentation prop, not a form input.
      const tag = node.parent.parent.tagName?.getText(source);
      if (tag !== 'AdminStatCard') result.fieldsAndEvents.push(print(node));
    }
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && charts.has(node.tagName.getText(source))) {
      result.chartStructure.push({
        tag: node.tagName.getText(source),
        // Palette and motion are the permitted presentation changes; retain data,
        // series, axes, tooltip, legend, aggregation and event attributes exactly.
        attributes: node.attributes.properties.filter((attr) => !ts.isJsxAttribute(attr) || !['stroke', 'fill', 'isAnimationActive'].includes(attr.name.getText(source))).map(print),
      });
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return result;
}
const results = [];
function scan(directory) {
  for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
    const before = path.join(directory, item.name);
    if (item.isDirectory()) { scan(before); continue; }
    if (!before.endsWith('.tsx')) continue;
    const relative = path.relative(beforeRoot, before);
    const oldContract = readContract(before);
    const newContract = readContract(path.join(root, relative));
    const checks = Object.fromEntries(Object.keys(oldContract).map((key) => [key, JSON.stringify(oldContract[key]) === JSON.stringify(newContract[key])]));
    results.push({ file: relative, checks });
  }
}
scan(beforeRoot);
const output = { kind: 'Static AST contract comparison; not runtime or visual proof', results, pass: results.every(({ checks }) => Object.values(checks).every(Boolean)) };
fs.writeFileSync(path.join(folder, 'presentation_contract.json'), JSON.stringify(output, null, 2));
console.log(JSON.stringify(output, null, 2));
if (!output.pass) process.exitCode = 1;
