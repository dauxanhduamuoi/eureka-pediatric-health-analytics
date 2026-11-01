const path = require('node:path'), fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '../../..');
const dependency = createRequire(path.join(root, 'Frontend/package.json'));
(async () => {
  const { build } = await import(pathToFileURL(dependency.resolve('vite')).href);
  const react = (await import(pathToFileURL(dependency.resolve('@vitejs/plugin-react')).href)).default;
  const tailwind = (await import(pathToFileURL(path.join(root, 'Frontend/node_modules/@tailwindcss/vite/dist/index.mjs')).href)).default;
  const phase = process.argv[2]; if (!['before', 'after'].includes(phase)) throw new Error('Choose before or after');
  const outDir = path.resolve(__dirname, 'browser-dist-' + phase);
  if (!outDir.startsWith(__dirname + path.sep)) throw new Error('Invalid artifact destination');
  await build({ configFile: false, envFile: false, root: path.join(__dirname, 'browser-fixture'), publicDir: false, plugins: [react(), tailwind()],
    resolve: { alias: { '@': path.join(root, 'Frontend/src'), react: path.dirname(dependency.resolve('react/package.json')), 'react-dom': path.dirname(dependency.resolve('react-dom/package.json')) } },
    build: { outDir, emptyOutDir: false, minify: false }, logLevel: 'warn',
  });
  console.log('Fixture built: ' + phase);
})().catch(error => { console.error(error); process.exitCode = 1; });
