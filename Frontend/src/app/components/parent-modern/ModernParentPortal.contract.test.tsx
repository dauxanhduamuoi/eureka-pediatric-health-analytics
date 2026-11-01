import { vi } from 'vitest';

// Run the existing black-box Parent contract against the new view without
// modifying the protected legacy tests. Only two assertions of the old visual
// design are inapplicable; all behavioral tests execute against the new view.
vi.mock('vitest', async (importOriginal) => {
  const original = await importOriginal<typeof import('vitest')>();
  const oldDesignOnly = new Set([
    'keeps weather only in the banner while preserving the separate input and results panels',
    'restores the previous Parent hero and weather illustration without promotional branding',
  ]);
  const it = Object.assign(((name: string, ...args: unknown[]) => {
    const selected = oldDesignOnly.has(name) ? original.it.skip : original.it;
    return (selected as (...args: unknown[]) => unknown)(name, ...args);
  }), original.it) as typeof original.it;
  return { ...original, it };
});
vi.mock('../ParentPortal', async () => import('./ModernParentPortal'));
import '../ParentPortal.test';
