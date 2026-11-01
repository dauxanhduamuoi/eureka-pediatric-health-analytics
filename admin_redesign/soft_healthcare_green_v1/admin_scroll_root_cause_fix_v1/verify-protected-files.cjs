const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'baseline.json'), 'utf8'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const entries = Object.entries(baseline.files).map(([file, before]) => {
  const filename = path.join(root, file), after = fs.existsSync(filename) ? hash(fs.readFileSync(filename)) : null;
  return { file, before, after, unchanged: before === after };
});
function walk(relative) { return fs.readdirSync(path.join(root, relative), { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(relative + '/' + e.name) : [relative + '/' + e.name]); }
const unexpectedChanges = entries.filter(e => !e.unchanged);
const newSourceFiles = walk('Frontend/src').filter(file => !Object.hasOwn(baseline.files, file));
const script = fs.readFileSync(path.join(__dirname, 'CAPTURE_SCROLL_MEASUREMENTS.js'), 'utf8');
const artifactTrailingWhitespace = script.split(/\r?\n/).flatMap((line, i) => /[\t ]+$/.test(line) ? [i + 1] : []);
const summary = { protectedFiles: entries.length, unexpectedChanges, newSourceFiles, artifactTrailingWhitespace, indexUnchanged: entries.find(e => e.file === '.git/index')?.unchanged, realDatabaseExcluded: true };
summary.status = !unexpectedChanges.length && !newSourceFiles.length && !artifactTrailingWhitespace.length && summary.indexUnchanged ? 'PASS' : 'FAIL';
fs.writeFileSync(path.join(__dirname, 'protected-hashes-after.json'), JSON.stringify({ ...summary, entries }, null, 2) + '\n');
fs.writeFileSync(path.join(__dirname, 'safety-check.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
if (summary.status !== 'PASS') process.exitCode = 1;
