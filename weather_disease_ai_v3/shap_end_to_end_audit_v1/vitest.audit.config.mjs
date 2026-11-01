import { defineConfig } from '../../Frontend/node_modules/vitest/dist/config.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const frontend = path.resolve(here, '../../Frontend');
export default defineConfig({
  root: path.resolve(here, '../..'),
  esbuild: { jsx: 'automatic' },
  resolve: { alias: {
    '@': path.join(frontend, 'src'),
    react: path.join(frontend, 'node_modules/react'),
    'react-dom': path.join(frontend, 'node_modules/react-dom'),
  } },
  test: {
    environment: 'jsdom', globals: true,
    setupFiles: [path.join(frontend, 'src/test/setup.ts')],
    include: ['weather_disease_ai_v3/shap_end_to_end_audit_v1/presentation.audit.test.tsx'],
  },
});
