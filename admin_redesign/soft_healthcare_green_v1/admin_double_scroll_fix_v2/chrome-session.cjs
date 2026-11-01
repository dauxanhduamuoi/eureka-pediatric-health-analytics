// Isolated installed Chrome only: no existing profile, account or application API.
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { spawn } = require('node:child_process');
module.exports = async function openChrome() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'eureka-scroll-chrome-'));
  const child = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
    '--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
    '--disable-component-update', '--disable-sync', '--disable-extensions', '--metrics-recording-only',
    '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank',
  ], { windowsHide: true, stdio: 'ignore' });
  let ws;
  try {
    const portFile = path.join(profile, 'DevToolsActivePort');
    const started = Date.now();
    while (!fs.existsSync(portFile)) {
      if (Date.now() - started > 15000 || child.exitCode !== null) throw new Error('Isolated Chrome did not expose DevTools');
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const [port, endpoint] = fs.readFileSync(portFile, 'utf8').trim().split(/\r?\n/);
    ws = new WebSocket(`ws://127.0.0.1:${port}${endpoint}`);
    await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
    let id = 0; const pending = new Map();
    ws.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (!message.id) return;
      const task = pending.get(message.id); if (!task) return;
      pending.delete(message.id); clearTimeout(task.timer);
      message.error ? task.reject(new Error(JSON.stringify(message.error))) : task.resolve(message.result);
    });
    const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
      const number = ++id;
      const timer = setTimeout(() => { pending.delete(number); reject(new Error('CDP timeout: ' + method)); }, 15000);
      pending.set(number, { resolve, reject, timer }); ws.send(JSON.stringify({ id: number, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    await send('Runtime.enable', {}, sessionId); await send('Page.enable', {}, sessionId);
    const evaluate = async expression => {
      const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    return { send, sessionId, evaluate, version: await send('Browser.getVersion'),
      close: async () => { try { await send('Browser.close'); } catch {} ws.close(); },
    };
  } catch (error) {
    ws?.close(); child.kill(); // Only the fresh Chrome process spawned above; never another PID.
    throw error;
  }
};
