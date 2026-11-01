import { render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import type { CurrentUser } from '@/lib/api';
import { canAccessTab, TAB_PERMISSIONS } from '../../navigation';
import { useAdminSectionNavigation } from '../../useAdminSectionNavigation';

const staff: CurrentUser = { id: 1, username: 'fixture', full_name: null, role: 'staff', is_active: true, permissions: ['feature.dashboard'] };
function RouteProbe({ user }: { user: CurrentUser }) {
  return <output aria-label="Selected section">{useAdminSectionNavigation(user).activeTab}</output>;
}
afterEach(() => window.history.replaceState({}, '', '/'));

it('preserves the import permission for admin, authorized staff, unauthorized staff and anonymous users', () => {
  expect(TAB_PERMISSIONS['data-import']).toBe('feature.data_import');
  expect(canAccessTab({ ...staff, role: 'admin', permissions: [] }, 'data-import')).toBe(true);
  expect(canAccessTab({ ...staff, permissions: ['feature.data_import'] }, 'data-import')).toBe(true);
  expect(canAccessTab(staff, 'data-import')).toBe(false);
  expect(canAccessTab(null, 'data-import')).toBe(false);
});

it('allows the existing import deep link with permission and falls back safely without it', () => {
  window.history.replaceState({}, '', '/?section=data-import');
  const view = render(<RouteProbe user={{ ...staff, permissions: ['feature.dashboard', 'feature.data_import'] }} />);
  expect(screen.getByLabelText('Selected section')).toHaveTextContent('data-import');
  view.unmount();
  window.history.replaceState({}, '', '/?section=data-import');
  render(<RouteProbe user={staff} />);
  expect(screen.getByLabelText('Selected section')).toHaveTextContent('dashboard');
});
