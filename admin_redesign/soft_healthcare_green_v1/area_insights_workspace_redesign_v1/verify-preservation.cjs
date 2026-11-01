const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = process.cwd();
const ts = require(path.join(root, 'Frontend/node_modules/typescript'));
const evidence = __dirname;
const page = 'Frontend/src/app/components/AreaInsights.tsx';
const before = ts.createSourceFile('before.tsx', fs.readFileSync(path.join(evidence, 'source_before', page), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const after = ts.createSourceFile('after.tsx', fs.readFileSync(path.join(root, page), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const printer = ts.createPrinter({ removeComments: true });
const print = (node, source) => printer.printNode(ts.EmitHint.Unspecified, node, source);
const main = (source) => source.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === 'AreaInsights');
const core = (source) => main(source).body.statements.filter((node) => !ts.isReturnStatement(node) && !node.getText(source).includes('[provincePickerOpen, setProvincePickerOpen]')).map((node) => print(node, source));
const helpers = (source) => source.statements.filter((node) => !ts.isImportDeclaration(node) && node !== main(source) && !(ts.isFunctionDeclaration(node) && ['PaginationControls'].includes(node.name?.text))).map((node) => print(node, source));
const compare = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const baseline = JSON.parse(fs.readFileSync(path.join(evidence, 'baseline.json'), 'utf8'));
const hashes = baseline.hashes || baseline.files;
if (!hashes || Array.isArray(hashes)) throw new Error('Inspect baseline schema before using this verifier.');
const changed = [], missing = [];
for (const [name, expected] of Object.entries(hashes)) {
  const target = path.join(root, name);
  if (!fs.existsSync(target)) { missing.push(name); continue; }
  const actual = crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex');
  const oldHash = typeof expected === 'string' ? expected : expected.sha256;
  if (actual.toLowerCase() !== oldHash.toLowerCase()) changed.push({ path: name, before: oldHash, after: actual });
}
const outsideChanges = changed.filter((item) => item.path !== page);
const output = {
  mainNonPresentationStatementsUnchanged: compare(core(before), core(after)),
  comparedMainStatements: core(before).length,
  helpersConstantsTypesUnchanged: compare(helpers(before), helpers(after)),
  comparedTopLevelDeclarations: helpers(before).length,
  excludedPresentationChanges: ['Imports', 'AreaInsights outer JSX return', 'Obsolete provincePickerOpen state', 'Pagination button type and accessible names'],
  protectedInventoryCount: Object.keys(hashes).length,
  changedBaselineFiles: changed, missingBaselineFiles: missing, outsideAllowedFileChanges: outsideChanges,
  note: 'Real database files are excluded. New page-specific source and evidence files are audited separately.',
};
fs.writeFileSync(path.join(evidence, 'preservation-check.json'), JSON.stringify(output, null, 2));
console.log(JSON.stringify(output, null, 2));
if (!output.mainNonPresentationStatementsUnchanged || !output.helpersConstantsTypesUnchanged || outsideChanges.length || missing.length) process.exitCode = 1;
