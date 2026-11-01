import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from '../../../Frontend/node_modules/typescript/lib/typescript.js';

const folder = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(folder, '../../..');
const oldPath = path.join(folder, 'source_before/Frontend/src/app/components/Settings.tsx');
const old = fs.readFileSync(oldPath, 'utf8');
const currentPaths = [
  'Frontend/src/app/components/Settings.tsx',
  'Frontend/src/app/components/PermissionsPage.tsx',
  'Frontend/src/app/components/admin/permissions/useUserAdministration.ts',
  'Frontend/src/app/components/admin/permissions/UserAccountForms.tsx',
  'Frontend/src/app/components/admin/permissions/PermissionDialogs.tsx',
  'Frontend/src/app/components/admin/permissions/PermissionControls.tsx',
];
const printer = ts.createPrinter({ removeComments: true });
function extract(text) {
  const source = ts.createSourceFile('source.tsx', text.replace(/\r\n/g, '\n'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const functions = new Map();
  const hooks = [];
  const apiCalls = [];
  const expressions = new Map();
  const print = (node) => printer.printNode(ts.EmitHint.Unspecified, node, source);
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.body) functions.set(node.name?.text, print(node.body));
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) expressions.set(node.name.text, print(node.initializer));
    if (ts.isCallExpression(node)) {
      if (/^use(State|Effect|Memo)$/.test(node.expression.getText(source))) hooks.push(print(node));
      if (/^api\./.test(node.expression.getText(source))) apiCalls.push(print(node));
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return { functions, hooks, apiCalls, expressions };
}
const before = extract(old);
const after = currentPaths.map((file) => extract(fs.readFileSync(path.join(root, file), 'utf8')));
const functions = [
  'loadUsers', 'handleCreateUser', 'selectedUser', 'togglePermission',
  'saveSelectedUserPermissions', 'handleResetPassword', 'downloadCreatedAccounts',
  'handleBulkCreate', 'updatePref', 'handleSave', 'handleReset',
  'PermissionChecklist', 'RoleSelect', 'Input',
];
const functionChecks = Object.fromEntries(functions.map((name) => [name, after.some((entry) => entry.functions.get(name) === before.functions.get(name))]));
const expressions = ['isAdmin', 'canAdmin', 'visiblePermissionDefs', 'adminDefaultPermissions', 'defaultPermissionsForRole', 'roleLabels', 'filteredUsers', 'userTotalPages', 'pagedUsers'];
const expressionChecks = Object.fromEntries(expressions.map((name) => [name, after.some((entry) => entry.expressions.get(name) === before.expressions.get(name))]));
const sameBag = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
const checks = {
  functionBodies: functionChecks,
  roleFilterAndPolicyExpressions: expressionChecks,
  hookInitializersAndEffects: sameBag(before.hooks, after.flatMap((entry) => entry.hooks)),
  apiCallExpressionsAndPayloads: sameBag(before.apiCalls, after.flatMap((entry) => entry.apiCalls)),
};
const pass = Object.values(functionChecks).every(Boolean) && Object.values(expressionChecks).every(Boolean) && checks.hookInitializersAndEffects && checks.apiCallExpressionsAndPayloads;
fs.writeFileSync(path.join(folder, 'extraction_contract.json'), JSON.stringify({ pass, checks, scope: 'Static extraction parity; does not prove visual or live authentication behaviour' }, null, 2));
console.log(JSON.stringify({ pass, checks }, null, 2));
if (!pass) process.exitCode = 1;
