import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/lib/i18n';
import * as api from '@/lib/api';
import { addNotification } from '@/lib/notifications';
import Forecast from './Forecast';

vi.mock('@/lib/api', async (original) => ({ ...await original<typeof import('@/lib/api')>(),
  getDiseaseBilingual: vi.fn(), getForecastGroupSummary: vi.fn(), getForecastResults: vi.fn(), runForecast: vi.fn(),
}));
vi.mock('@/lib/notifications', () => ({ addNotification: vi.fn() }));
vi.mock('recharts', async (original) => ({ ...await original<typeof import('recharts')>(),
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
const rows = (name = 'Nhóm kiểm thử mới') => [{ forecast_period: '2026-10', disease_group: name,
  previous_cases: 10, predicted_cases: 12, change_percent: 20, trend: 'Tăng', risk_level: 'Trung bình' }];
const mount = () => render(<I18nProvider><Forecast /></I18nProvider>);
const run = () => screen.getByRole('button', { name: 'Chạy dự báo' });
beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear();
  vi.mocked(api.getDiseaseBilingual).mockResolvedValue({});
  vi.mocked(api.getForecastGroupSummary).mockResolvedValue(rows());
  vi.mocked(api.getForecastResults).mockResolvedValue([]);
  vi.mocked(api.runForecast).mockResolvedValue({ message: 'OK', result: {} });
});

it('reports a forecast read error instead of converting it into a successful empty response', async () => {
  vi.mocked(api.getForecastGroupSummary).mockRejectedValueOnce(new Error('Forecast read 503 fixture'));
  mount();
  expect(await screen.findByText('Forecast read 503 fixture')).toBeVisible();
  expect(api.runForecast).not.toHaveBeenCalled();
  expect(localStorage.getItem('sd_chart_cache_forecast')).toBeNull();
});

it('does not announce completion when the run succeeds but fetching its results fails', async () => {
  mount(); await screen.findAllByText('Nhóm kiểm thử mới');
  vi.mocked(api.getForecastResults).mockRejectedValueOnce(new Error('Forecast results 502 fixture'));
  fireEvent.click(run());
  expect((await screen.findAllByText('Forecast results 502 fixture'))[0]).toBeVisible();
  expect(screen.queryByText('Chạy dự báo xong.')).not.toBeInTheDocument();
  expect(addNotification).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Chạy dự báo xong.' }));
  expect(screen.getByText(/Dữ liệu bên dưới thuộc kết quả trước đó/)).toBeVisible();
  expect(run()).toBeEnabled();
});

it('keeps the previous response visible with an explicit warning after a refresh failure', async () => {
  mount(); await screen.findAllByText('Nhóm kiểm thử mới');
  const cache = localStorage.getItem('sd_chart_cache_forecast');
  vi.mocked(api.getForecastGroupSummary).mockRejectedValueOnce(new Error('Refresh denied fixture'));
  fireEvent.click(screen.getByRole('button', { name: 'Làm mới' }));
  expect(await screen.findByText('Refresh denied fixture')).toBeVisible();
  expect(screen.getByText(/Dữ liệu bên dưới thuộc kết quả trước đó/)).toBeVisible();
  expect(screen.getAllByText('Nhóm kiểm thử mới').length).toBeGreaterThan(0);
  expect(localStorage.getItem('sd_chart_cache_forecast')).toBe(cache);
});

it('ignores an initial read that finishes after a newer run has completed', async () => {
  let finishOld!: (value: api.ForecastGroupSummary[]) => void;
  vi.mocked(api.getForecastGroupSummary).mockReturnValueOnce(new Promise((done) => { finishOld = done; }));
  mount(); fireEvent.click(run());
  await screen.findByText('Chạy dự báo xong.');
  expect(api.runForecast).toHaveBeenCalledExactlyOnceWith('auto', 1);
  await act(async () => finishOld(rows('Nhóm kiểm thử cũ')));
  expect(screen.queryByText('Nhóm kiểm thử cũ')).not.toBeInTheDocument();
  expect(screen.getAllByText('Nhóm kiểm thử mới').length).toBeGreaterThan(0);
});

it('retries successfully after an error and accepts a genuinely empty successful response', async () => {
  vi.mocked(api.getForecastResults).mockRejectedValueOnce(new Error('Temporary fixture'));
  mount(); await screen.findByText('Temporary fixture');
  vi.mocked(api.getForecastGroupSummary).mockResolvedValueOnce([]);
  fireEvent.click(screen.getByRole('button', { name: 'Làm mới' }));
  await waitFor(() => expect(screen.queryByText('Temporary fixture')).not.toBeInTheDocument());
  await waitFor(() => expect(screen.getByRole('button', { name: 'Làm mới' })).toBeEnabled());
  expect(JSON.parse(localStorage.getItem('sd_chart_cache_forecast')!).summary).toEqual([]);
  expect(api.runForecast).not.toHaveBeenCalled();
});
