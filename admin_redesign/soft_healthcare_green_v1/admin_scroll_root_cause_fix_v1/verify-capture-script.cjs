// Artifact/schema/privacy check only. This is NOT browser layout verification.
const fs = require('node:fs'), path = require('node:path');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../../..');
const dependency = createRequire(path.join(root, 'Frontend/package.json'));
const { JSDOM } = dependency('jsdom');
const script = fs.readFileSync(path.join(__dirname, 'CAPTURE_SCROLL_MEASUREMENTS.js'), 'utf8');
const dom = new JSDOM('<!doctype html><html><body><div id="root"><div class="eureka-admin"><div class="admin-workspace"><main id="admin-content"><div class="admin-page" data-section="areas"><div class="area-insights-workspace"><table><tbody><tr><td>PRIVATE_MEDICAL_FIXTURE</td></tr></tbody></table><input value="PRIVATE_INPUT_FIXTURE"><div class="area-recommendations">PRIVATE_USER_FIXTURE</div></div></div></main></div></div></div></body></html>', { runScripts: 'outside-only', url: 'http://fixture.invalid/' });
const w = dom.window, output = [];
const originalStyle = w.getComputedStyle.bind(w);
w.getComputedStyle = (element, pseudo) => pseudo ? { content: 'none', display: 'none' } : originalStyle(element);
w.console.log = value => output.push(value);
let forbiddenCalls = 0;
w.fetch = () => { forbiddenCalls++; throw new Error('Network access is forbidden'); };
w.scrollTo = () => { forbiddenCalls++; throw new Error('Scrolling is forbidden'); };
Object.defineProperty(w, 'localStorage', { get() { forbiddenCalls++; throw new Error('Storage access is forbidden'); } });
Object.defineProperty(w, 'sessionStorage', { get() { forbiddenCalls++; throw new Error('Storage access is forbidden'); } });
Object.defineProperty(w.document, 'cookie', { get() { forbiddenCalls++; throw new Error('Cookie access is forbidden'); } });
const before = w.document.documentElement.outerHTML;
const report = w.eval(script);
const serialized = output[0];
const checks = {
  fixtureOnly: true, realGeometryVerified: false,
  correctSchema: report.schema === 'eureka-scroll-measurements-v1',
  correctSection: report.section === 'areas',
  capturesCoreContainers: report.adminContentFound && report.containers.some(c => c.selector === '#admin-content' && c.matches.length === 1),
  jsonSerializable: JSON.parse(serialized).schema === report.schema,
  leavesDomUnchanged: before === w.document.documentElement.outerHTML,
  noNetworkScrollStorageCookieCalls: forbiddenCalls === 0,
  noSensitiveFixtureTextInOutput: !/PRIVATE_(MEDICAL|INPUT|USER)_FIXTURE/.test(serialized),
  noFixtureHostInOutput: !serialized.includes('fixture.invalid'),
};
checks.status = Object.entries(checks).every(([key, value]) => ['fixtureOnly', 'realGeometryVerified'].includes(key) || value === true) ? 'PASS' : 'FAIL';
fs.writeFileSync(path.join(__dirname, 'capture-script-check.json'), JSON.stringify(checks, null, 2) + '\n');
console.log(JSON.stringify(checks, null, 2));
w.close();
if (checks.status !== 'PASS') process.exitCode = 1;
