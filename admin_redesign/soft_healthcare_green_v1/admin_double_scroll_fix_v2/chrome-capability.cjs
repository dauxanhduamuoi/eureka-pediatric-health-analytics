const fs = require('node:fs'), path = require('node:path');
(async () => {
  const browser = await require('./chrome-session.cjs')();
  try {
    const result = { version: browser.version.product, hasSelector: await browser.evaluate('CSS.supports("selector(html:has(.eureka-admin > .admin-workspace))")') };
    fs.writeFileSync(path.join(__dirname, 'chrome-capability.json'), JSON.stringify(result, null, 2) + '\n');
    console.log(result);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
