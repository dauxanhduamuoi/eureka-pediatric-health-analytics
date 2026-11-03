import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/lib/i18n';
import ModernParentPortal from './ModernParentPortal';
import { PARENT_HERO_INTERVAL_MS } from './ParentHeroCarousel';

const mocks = vi.hoisted(() => ({ listAreaProvinces: vi.fn(), getPublicWeatherAIOptions: vi.fn(), getPublicDiseaseKnowledge: vi.fn(), predictPublicParentRisk: vi.fn() }));
vi.mock('@/lib/api', async (original) => ({ ...await original<typeof import('@/lib/api')>(), ...mocks }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
  mocks.listAreaProvinces.mockResolvedValue([{ code: 'HCM', name: 'TP.HCM', latitude: 10.78, longitude: 106.69, is_active: true }]);
  mocks.getPublicWeatherAIOptions.mockResolvedValue({ age_groups: ['1-5 tuổi', '6-10 tuổi'], genders: ['Nam', 'Nữ'], disease_catalog: [], ranking_universe: 221 });
  mocks.getPublicDiseaseKnowledge.mockResolvedValue([]);
});
afterEach(() => vi.unstubAllGlobals());

it('keeps a compact brand-only header and the local healthcare asset without invented results', async () => {
  const { container } = render(<I18nProvider><ModernParentPortal /></I18nProvider>);
  await waitFor(() => expect(screen.getByLabelText('Độ tuổi')).toHaveValue('1-5 tuổi'));
  expect(screen.getByLabelText('Giới tính')).toHaveValue('Nam');
  expect(screen.getByLabelText('Số nhóm bệnh')).toHaveValue('5');
  const header = container.querySelector('.modern-header')!;
  expect(within(header as HTMLElement).queryByRole('navigation')).not.toBeInTheDocument();
  expect(header.querySelectorAll('a')).toHaveLength(1);
  expect(header.querySelector('a')).toHaveAttribute('href', '/phu-huynh');
  expect(screen.queryByRole('link', { name: 'Xem giao diện trước' })).not.toBeInTheDocument();
  expect(container.querySelector('.modern-hero-carousel img')).toHaveAttribute('src', '/assets/login/parent-child-lounge.webp');
  expect(screen.getByRole('link', { name: 'Theo dõi sức khỏe trẻ em' })).toHaveAttribute('href', '/phu-huynh');
  expect(container).not.toHaveTextContent(/Eureka/i);
  for (const element of container.querySelectorAll('[aria-label], [title], [alt]')) {
    expect(`${element.getAttribute('aria-label')} ${element.getAttribute('title')} ${element.getAttribute('alt')}`).not.toMatch(/Eureka/i);
  }
  expect(container.querySelector('.parent-portal')).toBeNull();
  expect(screen.getByTestId('parent-predict-submit')).toBeDisabled();
  expect(mocks.predictPublicParentRisk).not.toHaveBeenCalled();
});

it('keeps the introduction readable and identifies the existing AI illustration honestly', async () => {
  render(<I18nProvider><ModernParentPortal /></I18nProvider>);
  const hero = screen.getByRole('region', { name: 'Hiểu thời tiết, chăm sóc trẻ chủ động hơn.' });
  expect(within(hero).getByRole('heading', { level: 1 })).toHaveTextContent('Hiểu thời tiết, chăm sóc trẻ chủ động hơn.');
  expect(within(hero).getByText('Kết quả chỉ mang tính tham khảo, không thay thế chẩn đoán hoặc tư vấn y tế.')).toBeVisible();
  fireEvent.load(hero.querySelector('img')!);
  expect(within(hero).getByRole('img', { name: 'Ảnh minh họa AI: mẹ và con trong không gian chăm sóc sức khỏe.' })).toHaveAttribute('width', '960');
  expect(hero.querySelector('figcaption')).toBeNull();
  await waitFor(() => expect(screen.getByLabelText('Độ tuổi')).toHaveValue('1-5 tuổi'));
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

it('keeps form values, province search and focus while images rotate without new API requests', async () => {
  const view = render(<I18nProvider><ModernParentPortal /></I18nProvider>);
  await waitFor(() => expect(screen.getByLabelText('Độ tuổi')).toHaveValue('1-5 tuổi'));
  fireEvent.change(screen.getByLabelText('Độ tuổi'), { target: { value: '6-10 tuổi' } });
  fireEvent.change(screen.getByLabelText('Giới tính'), { target: { value: 'Nữ' } });
  fireEvent.change(screen.getByLabelText('Số nhóm bệnh'), { target: { value: '10' } });
  fireEvent.click(screen.getByTestId('province-combobox-trigger'));
  const search = screen.getByPlaceholderText('Tìm tỉnh/thành phố...');
  fireEvent.change(search, { target: { value: 'TP.' } });
  act(() => search.focus());
  const counts = [mocks.listAreaProvinces.mock.calls.length, mocks.getPublicWeatherAIOptions.mock.calls.length, mocks.getPublicDiseaseKnowledge.mock.calls.length];
  vi.useFakeTimers();
  try {
    view.container.querySelectorAll('.modern-hero-carousel img').forEach((image) => fireEvent.load(image));
    act(() => vi.advanceTimersByTime(PARENT_HERO_INTERVAL_MS));
    expect(screen.getByRole('button', { name: /^Ảnh 2:/ })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByLabelText('Độ tuổi')).toHaveValue('6-10 tuổi');
    expect(screen.getByLabelText('Giới tính')).toHaveValue('Nữ');
    expect(screen.getByLabelText('Số nhóm bệnh')).toHaveValue('10');
    expect(search).toHaveValue('TP.'); expect(search).toHaveFocus();
    expect([mocks.listAreaProvinces.mock.calls.length, mocks.getPublicWeatherAIOptions.mock.calls.length, mocks.getPublicDiseaseKnowledge.mock.calls.length]).toEqual(counts);
    expect(mocks.predictPublicParentRisk).not.toHaveBeenCalled();
  } finally { view.unmount(); vi.useRealTimers(); }
});
