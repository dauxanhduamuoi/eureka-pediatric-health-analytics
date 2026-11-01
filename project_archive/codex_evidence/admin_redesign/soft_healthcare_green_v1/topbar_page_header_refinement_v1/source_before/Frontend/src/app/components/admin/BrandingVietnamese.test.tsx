import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import i18next from 'i18next';
import { I18nProvider } from '@/lib/i18n';
import viStrings from '@/i18n/locales/vi';
import { Activity } from 'lucide-react';
import AdminLayout from './AdminLayout';
import AdminPageHeading from './AdminPageHeading';
import LoginPage from '../LoginPage';

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ login: vi.fn(), error: null, loading: false }) }));
const product = 'Theo dõi sức khỏe trẻ em';
beforeEach(async () => { window.innerWidth = 1440; await i18next.changeLanguage('vi'); });

it('uses the existing branding source in sidebar/topbar/title and keeps a labelled logo in the rail', () => {
  render(<I18nProvider><AdminLayout user={{ id: 1, username: 'admin', full_name: null, role: 'admin', is_active: true, permissions: [] }}
    items={[]} activeTab="dashboard" pageTitle="Tổng quan" unreadCount={0} onNavigate={vi.fn()} onLogout={vi.fn()}>
    <p>Nội dung</p>
  </AdminLayout></I18nProvider>);
  expect(document.title).toBe(product);
  expect(screen.getAllByText(product)).toHaveLength(2);
  expect(screen.queryByText(/Eureka/i)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Thu gọn' }));
  expect(screen.getByRole('img', { name: product })).toHaveAttribute('title', `${product} · Hệ thống phân tích dữ liệu`);
  expect(screen.getByText('Hệ thống phân tích dữ liệu')).toBeInTheDocument();
  expect(screen.getAllByText(product)).toHaveLength(2);
});

it('uses the same name on login and preserves labelled username/password fields and the Parent link', () => {
  render(<I18nProvider><LoginPage /></I18nProvider>);
  expect(screen.getByRole('heading', { name: product })).toBeVisible();
  expect(screen.getByLabelText('Tên đăng nhập')).toBeRequired();
  expect(screen.getByLabelText('Mật khẩu')).toBeRequired();
  expect(screen.getByRole('link', { name: 'Trang dành cho phụ huynh' })).toHaveAttribute('href', '/phu-huynh');
  expect(screen.queryByText(/Eureka/i)).not.toBeInTheDocument();
});

it.each([
  ['dashboard', 'Tổng hợp dữ liệu, diễn biến nhóm bệnh và kết quả dự báo.'],
  ['seasonal', 'So sánh diễn biến theo mùa và thời điểm ghi nhận.'],
  ['forecast', 'Theo dõi kết quả dự báo và chi tiết theo từng nhóm bệnh.'],
  ['reports', 'Tạo, xem trước và tải báo cáo từ dữ liệu hiện có.'],
  ['notifications', 'Theo dõi cập nhật hệ thống và các thông báo đang có.'],
  ['settings', 'Tùy chỉnh giao diện, ngôn ngữ và thông báo hệ thống.'],
  ['permissions', 'Quản lý tài khoản và quyền truy cập theo chính sách hiện có.'],
])('renders the exact Vietnamese description for %s', (key, expected) => {
  const text = viStrings[`admin.description.${key}` as keyof typeof viStrings];
  expect(text).toBe(expected);
  expect(text).not.toMatch(/[?\uFFFD]/);
  render(<AdminPageHeading icon={Activity} title="Kiểm tra tiếng Việt" description={text} />);
  expect(screen.getByText(expected)).toBeVisible();
});
