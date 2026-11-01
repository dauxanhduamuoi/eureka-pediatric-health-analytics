import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import i18next from 'i18next';
import { I18nProvider } from '@/lib/i18n';
import viStrings from '@/i18n/locales/vi';
import LoginPage from './LoginPage';

const auth = vi.hoisted(() => ({ login: vi.fn(), error: null as string | null, loading: false }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => auth }));
const mount = () => render(<I18nProvider><LoginPage /></I18nProvider>);

beforeEach(async () => {
  vi.clearAllMocks(); auth.error = null; auth.loading = false;
  auth.login.mockResolvedValue(undefined);
  await i18next.changeLanguage('vi');
});

it('keeps the brand, required credential fields, autocomplete and Parent link without internal/server copy', () => {
  const { container } = mount();
  expect(screen.getByRole('heading', { name: 'Theo dõi sức khỏe trẻ em' })).toBeVisible();
  expect(screen.getByLabelText('Tên đăng nhập')).toHaveAttribute('autocomplete', 'username');
  expect(screen.getByLabelText('Mật khẩu')).toHaveAttribute('type', 'password');
  expect(screen.getByLabelText('Mật khẩu')).toHaveAttribute('autocomplete', 'current-password');
  expect(screen.getByLabelText('Tên đăng nhập')).toBeRequired();
  expect(screen.getByLabelText('Mật khẩu')).toBeRequired();
  expect(container.querySelector('form')?.checkValidity()).toBe(false);
  expect(screen.getByRole('link', { name: 'Trang dành cho phụ huynh' })).toHaveAttribute('href', '/phu-huynh');
  expect(container).not.toHaveTextContent(/127\.0\.0\.1|FastAPI|Dùng tài khoản nội bộ/);
  expect(auth.login).not.toHaveBeenCalled();
});

it('submits unchanged credential values through the existing context and disables the pending submit', async () => {
  let resolve!: () => void;
  auth.login.mockReturnValue(new Promise<void>((done) => { resolve = done; }));
  const { container } = mount();
  fireEvent.change(screen.getByLabelText('Tên đăng nhập'), { target: { value: 'test-user' } });
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'isolated-password' } });
  fireEvent.submit(container.querySelector('form')!);
  expect(auth.login).toHaveBeenCalledExactlyOnceWith('test-user', 'isolated-password');
  expect(screen.getByRole('button', { name: viStrings['auth.loggingIn'] })).toBeDisabled();
  expect(container.querySelector('form')).toHaveAttribute('aria-busy', 'true');
  await act(async () => { resolve(); });
  expect(screen.getByRole('button', { name: 'Đăng nhập' })).toBeEnabled();
});

it('keeps the context error readable and allows retry without clearing entered credentials', async () => {
  auth.login.mockRejectedValueOnce(new Error('isolated failure'));
  const view = mount();
  fireEvent.change(screen.getByLabelText('Tên đăng nhập'), { target: { value: 'test-user' } });
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'isolated-password' } });
  fireEvent.submit(view.container.querySelector('form')!);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Đăng nhập' })).toBeEnabled());
  auth.error = 'Không thể đăng nhập. Vui lòng kiểm tra tên đăng nhập và mật khẩu.';
  view.rerender(<I18nProvider><LoginPage /></I18nProvider>);
  expect(screen.getByRole('alert')).toHaveTextContent(auth.error);
  expect(screen.getByLabelText('Tên đăng nhập')).toHaveValue('test-user');
  expect(screen.getByLabelText('Mật khẩu')).toHaveValue('isolated-password');
  auth.login.mockResolvedValueOnce(undefined);
  fireEvent.submit(view.container.querySelector('form')!);
  await waitFor(() => expect(auth.login).toHaveBeenCalledTimes(2));
});

it('uses the existing context loading state to prevent submit', () => {
  auth.loading = true;
  mount();
  expect(screen.getByRole('button', { name: viStrings['auth.loggingIn'] })).toBeDisabled();
  expect(auth.login).not.toHaveBeenCalled();
});

it('retains native form submission and required-field validation without adding a keyboard handler', async () => {
  const { container } = mount();
  const form = container.querySelector('form')!;
  act(() => form.requestSubmit());
  expect(auth.login).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('Tên đăng nhập'), { target: { value: 'test-user' } });
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'isolated-password' } });
  await act(async () => { form.requestSubmit(); });
  expect(auth.login).toHaveBeenCalledExactlyOnceWith('test-user', 'isolated-password');
});

it('reveals and hides the same password without changing its value, caret or input focus', () => {
  mount();
  const input = screen.getByLabelText('Mật khẩu') as HTMLInputElement;
  const value = '  Mật-khẩu-kiểm-thử_123  ';
  fireEvent.change(input, { target: { value } });
  act(() => { input.focus(); input.setSelectionRange(3, 8); });
  const toggle = screen.getByRole('button', { name: 'Hiện mật khẩu' });
  expect(toggle).toHaveAttribute('type', 'button');
  expect(toggle).toHaveAttribute('aria-controls', 'password');
  expect(toggle).toHaveAttribute('aria-pressed', 'false');
  expect(fireEvent.mouseDown(toggle)).toBe(false); // Prevent pointer focus stealing.
  fireEvent.click(toggle);
  expect(screen.getByLabelText('Mật khẩu')).toBe(input);
  expect(input).toHaveAttribute('type', 'text');
  expect(input).toHaveValue(value); expect(input).toHaveFocus();
  expect([input.selectionStart, input.selectionEnd]).toEqual([3, 8]);
  expect(screen.getByRole('button', { name: 'Ẩn mật khẩu' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.mouseDown(toggle); fireEvent.click(toggle);
  expect(input).toHaveAttribute('type', 'password');
  expect(input).toHaveValue(value); expect(input).toHaveFocus();
  expect(auth.login).not.toHaveBeenCalled();
});

it('keeps a keyboard-focusable native toggle that does not submit or lose button focus', () => {
  mount();
  const toggle = screen.getByRole('button', { name: 'Hiện mật khẩu' });
  expect(toggle.tabIndex).toBe(0);
  act(() => toggle.focus());
  fireEvent.click(toggle); // Native button activation; browser key dispatch is separate visual QA.
  expect(toggle).toHaveFocus();
  expect(toggle).toHaveAccessibleName('Ẩn mật khẩu');
  expect(auth.login).not.toHaveBeenCalled();
  expect(toggle.compareDocumentPosition(screen.getByRole('button', { name: 'Đăng nhập' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it('keeps the native Enter submit path with visible passwords and sends unchanged credentials', async () => {
  const { container } = mount();
  const username = screen.getByLabelText('Tên đăng nhập');
  const password = screen.getByLabelText('Mật khẩu');
  fireEvent.change(username, { target: { value: 'test-user' } });
  fireEvent.change(password, { target: { value: 'isolated-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Hiện mật khẩu' }));
  expect(password).toHaveAttribute('type', 'text');
  const key = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  expect(password.dispatchEvent(key)).toBe(true);
  expect(container.querySelectorAll('button[type="submit"]')).toHaveLength(1);
  // JSDOM does not synthesize implicit keyboard submission; exercise its native target.
  await act(async () => { container.querySelector('form')!.requestSubmit(); });
  expect(auth.login).toHaveBeenCalledExactlyOnceWith('test-user', 'isolated-password');
});

it('retains context loading and required validation after changing visibility', async () => {
  auth.loading = true;
  const { container } = mount();
  fireEvent.click(screen.getByRole('button', { name: 'Hiện mật khẩu' }));
  expect(screen.getByRole('button', { name: viStrings['auth.loggingIn'] })).toBeDisabled();
  expect(container.querySelector('form')).toHaveAttribute('aria-busy', 'true');
  expect(screen.getByLabelText('Mật khẩu')).toBeRequired();
  expect(container.querySelector('form')!.checkValidity()).toBe(false);
  expect(auth.login).not.toHaveBeenCalled();
});
