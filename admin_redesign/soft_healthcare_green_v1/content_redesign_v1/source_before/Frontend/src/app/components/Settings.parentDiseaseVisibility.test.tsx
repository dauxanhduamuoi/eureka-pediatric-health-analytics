import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/lib/i18n';
import Settings from './Settings';


const auth = vi.hoisted(() => ({
  user: {
    id: 1,
    username: 'staff',
    full_name: null,
    role: 'staff',
    is_active: true,
    permissions: [] as string[],
  },
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: auth.user }),
}));

vi.mock('@/lib/api', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/api')>(),
  listUsers: vi.fn().mockReturnValue(new Promise(() => undefined)),
  listRoles: vi.fn().mockReturnValue(new Promise(() => undefined)),
  listPermissions: vi.fn().mockReturnValue(new Promise(() => undefined)),
}));

vi.mock('./ParentDiseaseVisibilitySettings', () => ({
  default: () => <div data-testid="parent-disease-visibility-settings" />,
}));

function renderSettings() {
  return render(<I18nProvider><Settings /></I18nProvider>);
}

describe('Settings no longer embeds the Parent disease visibility editor', () => {
  beforeEach(() => {
    auth.user.role = 'staff';
    auth.user.permissions = [];
  });

  it('hides the policy editor from ordinary staff', () => {
    renderSettings();
    expect(screen.queryByTestId('parent-disease-visibility-settings')).not.toBeInTheDocument();
  });

  it('does not duplicate the policy editor for specialized staff', () => {
    auth.user.permissions = ['feature.parent_disease_visibility'];
    renderSettings();
    expect(screen.queryByTestId('parent-disease-visibility-settings')).not.toBeInTheDocument();
  });

  it('keeps Settings separate from the policy editor for admins', () => {
    auth.user.role = 'admin';
    renderSettings();
    expect(screen.queryByTestId('parent-disease-visibility-settings')).not.toBeInTheDocument();
  });
});
