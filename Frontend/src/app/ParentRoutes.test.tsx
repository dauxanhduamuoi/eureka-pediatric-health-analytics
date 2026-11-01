import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

vi.mock('./components/parent-modern/ModernParentPortal', () => ({ default: () => <div>MODERN_PARENT_ONLY</div> }));
vi.mock('./AppPages', () => ({ default: () => <div>ADMIN_PAGE</div>, ParentPortalPage: () => <div>LEGACY_PARENT_ONLY</div> }));
vi.mock('./contexts/AuthContext', () => ({ AuthProvider: ({ children }: { children: React.ReactNode }) => children, useAuth: () => ({ user: null, loading: false }) }));
vi.mock('./components/LoginPage', () => ({ default: () => <div>LOGIN_ONLY</div> }));
import App from './App';

afterEach(() => { cleanup(); window.history.replaceState({}, '', '/'); });

it.each(['/phu-huynh', '/phu-huynh/', '/parents'])('mounts only the new Parent at %s', async (path) => {
  window.history.replaceState({}, '', path); render(<App />);
  expect(await screen.findByText('MODERN_PARENT_ONLY')).toBeVisible();
  expect(screen.queryByText('LEGACY_PARENT_ONLY')).not.toBeInTheDocument();
  expect(screen.queryByText('LOGIN_ONLY')).not.toBeInTheDocument();
});
it('preserves the legacy route with an independent link back', async () => {
  window.history.replaceState({}, '', '/phu-huynh-cu'); render(<App />);
  expect(await screen.findByText('LEGACY_PARENT_ONLY')).toBeVisible();
  expect(screen.getByRole('link', { name: 'Giao diện mới' })).toHaveAttribute('href', '/phu-huynh');
  expect(screen.queryByText('MODERN_PARENT_ONLY')).not.toBeInTheDocument();
});
it('keeps the login entry point outside public routes', () => {
  render(<App />); expect(screen.getByText('LOGIN_ONLY')).toBeVisible();
  expect(screen.queryByText('LEGACY_PARENT_ONLY')).not.toBeInTheDocument();
});
