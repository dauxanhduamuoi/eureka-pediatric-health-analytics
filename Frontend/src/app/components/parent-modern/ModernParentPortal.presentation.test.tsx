import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/lib/i18n';
import ModernParentPortal from './ModernParentPortal';

const mocks = vi.hoisted(() => ({ listAreaProvinces: vi.fn(), getPublicWeatherAIOptions: vi.fn(), getPublicDiseaseKnowledge: vi.fn(), predictPublicParentRisk: vi.fn() }));
vi.mock('@/lib/api', async (original) => ({ ...await original<typeof import('@/lib/api')>(), ...mocks }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.listAreaProvinces.mockResolvedValue([{ code: 'HCM', name: 'TP.HCM', latitude: 10.78, longitude: 106.69, is_active: true }]);
  mocks.getPublicWeatherAIOptions.mockResolvedValue({ age_groups: ['1-5 tuổi', '6-10 tuổi'], genders: ['Nam', 'Nữ'], disease_catalog: [], ranking_universe: 221 });
  mocks.getPublicDiseaseKnowledge.mockResolvedValue([]);
});

it('uses the local healthcare asset and explicit version switch without invented results', async () => {
  const { container } = render(<I18nProvider><ModernParentPortal /></I18nProvider>);
  await waitFor(() => expect(screen.getByLabelText('Độ tuổi')).toHaveValue('1-5 tuổi'));
  expect(screen.getByLabelText('Giới tính')).toHaveValue('Nam');
  expect(screen.getByLabelText('Số nhóm bệnh')).toHaveValue('5');
  expect(screen.getByRole('link', { name: 'Xem giao diện trước' })).toHaveAttribute('href', '/phu-huynh-cu');
  expect(container.querySelector('.modern-hero-photo img')).toHaveAttribute('src', '/assets/login/parent-child-lounge.webp');
  expect(container.querySelector('.parent-portal')).toBeNull();
  expect(screen.getByTestId('parent-predict-submit')).toBeDisabled();
  expect(mocks.predictPublicParentRisk).not.toHaveBeenCalled();
});

it('lets keyboard users close province search without submitting a prediction', async () => {
  render(<I18nProvider><ModernParentPortal /></I18nProvider>);
  const trigger = await screen.findByTestId('province-combobox-trigger');
  fireEvent.click(trigger);
  const input = screen.getByPlaceholderText('Tìm tỉnh/thành phố...');
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(mocks.predictPublicParentRisk).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: 'Escape' });
  expect(trigger).toHaveFocus();
  expect(trigger).toHaveAttribute('aria-expanded', 'false');
});
