import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { WeatherAIDiseaseRanking, WeatherAITier1Factor } from '@/lib/api';
import { WeatherAIExplanationSections } from '../weather-ai/WeatherAIResults';
import AdminWeatherAIResults from './AdminWeatherAIResults';
import fixture from '../../../../../weather_disease_ai_v3/shap_explanation_fix_v1/backend_after.json';

const base = () => structuredClone(fixture.predictions[0]) as unknown as WeatherAIDiseaseRanking;
function prediction(id: string, rank: number): WeatherAIDiseaseRanking {
  const row = base();
  const factor = (feature: string, shap: number, weather: string): WeatherAITier1Factor => ({ feature, label_vi: feature, category: 'WEATHER', window: '7D', input_value: 12,
    shap_value: shap, direction: shap > 0 ? 'UP' : 'DOWN', weather_factor: weather });
  const factors = [factor('rain_sum_7d', .8, 'RAIN'), factor('temperature_mean_7d', -.5, 'TEMPERATURE'),
    factor('wind_speed_mean_7d', .4, 'WIND'), factor('wind_speed_max_7d', -.2, 'WIND')];
  return { ...row, disease_id: id, rank, disease_name: `Nhóm ${id} - English ${id}`, tier1: { ...row.tier1, available: true,
    display_factors: factors, positive_factors: factors.filter((f) => f.shap_value > 0), negative_factors: factors.filter((f) => f.shap_value < 0) } };
}
const cards = () => screen.getAllByTestId('weather-ai-prediction-card');
const button = (index = 0) => within(cards()[index]).getByRole('button');

it('defaults to compact cards with rank, bilingual names and no mounted explanations', () => {
  render(<AdminWeatherAIResults predictions={[prediction('A', 6), prediction('B', 7)]} />);
  expect(cards()).toHaveLength(2);
  expect(screen.getByLabelText('Xếp hạng 6')).toHaveTextContent('#6');
  expect(screen.getByRole('heading', { name: 'Nhóm A' })).toBeVisible();
  expect(screen.getByText('English A')).toBeVisible();
  expect(button()).toHaveAttribute('aria-expanded', 'false');
  expect(document.getElementById(button().getAttribute('aria-controls')!)).toHaveAttribute('hidden');
  expect(screen.queryByLabelText('Giải thích xếp hạng của mô hình')).not.toBeInTheDocument();
  expect(screen.queryByTestId(/^tier1-group-/)).not.toBeInTheDocument();
  expect(screen.getByLabelText('Lưu ý quan trọng')).toBeVisible();
});

it('opens exactly one disease, closes it and keeps an accessible native toggle', () => {
  render(<AdminWeatherAIResults predictions={[prediction('A', 1), prediction('B', 2)]} />);
  const first = button(); first.focus(); fireEvent.click(first);
  expect(first).toHaveFocus(); expect(first).toHaveAttribute('type', 'button');
  expect(first).toHaveAttribute('aria-expanded', 'true');
  expect(first).toHaveAccessibleName('Thu gọn: Nhóm A');
  expect(within(cards()[0]).getByRole('region', { name: 'Nhóm A' })).toBeVisible();
  fireEvent.click(button(1));
  expect(first).toHaveAttribute('aria-expanded', 'false');
  expect(within(cards()[0]).queryByLabelText('Giải thích xếp hạng của mô hình')).not.toBeInTheDocument();
  expect(within(cards()[1]).getByLabelText('Giải thích xếp hạng của mô hình')).toBeVisible();
  fireEvent.click(button(1));
  expect(screen.queryByLabelText('Giải thích xếp hạng của mô hình')).not.toBeInTheDocument();
});

it('reuses the entire existing clinical explanation with identical text, sources and all SHAP directions', () => {
  const row = prediction('A', 1); const original = JSON.stringify(row);
  const direct = render(<WeatherAIExplanationSections prediction={row} />);
  const expected = direct.container.textContent;
  direct.unmount();
  render(<AdminWeatherAIResults predictions={[row]} />); fireEvent.click(button());
  const body = document.getElementById(button().getAttribute('aria-controls')!)!;
  expect(body.textContent).toBe(expected);
  expect(within(body).getByTestId('tier1-group-weather:PRECIPITATION:7D')).toBeVisible();
  expect(within(body).getByTestId('tier1-group-weather:TEMPERATURE:7D')).toBeVisible();
  expect(within(body).getByTestId('tier1-group-weather:WIND:7D')).toHaveTextContent('tăng và giảm theo hai chiều');
  expect(within(body).queryByRole('button', { name: 'Xem tất cả yếu tố' })).not.toBeInTheDocument();
  expect(JSON.stringify(row)).toBe(original);
});

it('resets on a replacement or reordered result and identifies the clicked disease by ID', () => {
  const a = prediction('A', 1), b = prediction('B', 2);
  const view = render(<AdminWeatherAIResults predictions={[a, b]} />);
  fireEvent.click(button());
  view.rerender(<AdminWeatherAIResults predictions={[b, a]} />);
  expect(screen.getAllByRole('button', { name: /^Xem chi tiết/ })).toHaveLength(2);
  fireEvent.click(button());
  expect(screen.getByRole('region', { name: 'Nhóm B' })).toBeVisible();
  expect(screen.queryByRole('region', { name: 'Nhóm A' })).not.toBeInTheDocument();
  view.rerender(<AdminWeatherAIResults predictions={[structuredClone(b), structuredClone(a)]} />);
  expect(screen.queryByLabelText('Giải thích xếp hạng của mô hình')).not.toBeInTheDocument();
});

it('renders empty and unavailable explanations honestly, and blocks opening while loading', () => {
  const view = render(<AdminWeatherAIResults predictions={[]} />);
  expect(screen.getByRole('status')).toHaveTextContent('Không có nhóm bệnh phù hợp');
  const row = prediction('A', 1); row.tier1.available = false; row.tier2.available = false;
  view.rerender(<AdminWeatherAIResults predictions={[row]} disabled />);
  expect(button()).toBeDisabled(); fireEvent.click(button());
  expect(screen.queryByText(/Chưa có giải thích/)).not.toBeInTheDocument();
  view.rerender(<AdminWeatherAIResults predictions={[row]} />); fireEvent.click(button());
  expect(screen.getByText('Chưa có giải thích cho nhóm bệnh này trong kết quả hiện tại.')).toBeVisible();
});

it.each(['UP', 'DOWN'] as const)('preserves a %s-only explanation and very long bilingual names', (direction) => {
  const row = prediction('A', 1);
  row.disease_name = `${'Tên nhóm bệnh rất dài '.repeat(8)} - ${'Long English disease name '.repeat(8)}`;
  const factors = row.tier1.display_factors!.filter((f) => f.direction === direction && f.weather_factor !== 'WIND');
  row.tier1.display_factors = factors;
  row.tier1.positive_factors = direction === 'UP' ? factors : [];
  row.tier1.negative_factors = direction === 'DOWN' ? factors : [];
  render(<AdminWeatherAIResults predictions={[row]} />); fireEvent.click(button());
  expect(screen.getByRole('heading', { name: /Tên nhóm bệnh rất dài/ })).toHaveTextContent('Tên nhóm bệnh rất dài '.repeat(8).trim());
  expect(screen.getByText('Long English disease name '.repeat(8).trim())).toBeVisible();
  const body = document.getElementById(button().getAttribute('aria-controls')!)!;
  expect(body.querySelectorAll('[data-testid^="tier1-group-"]')).toHaveLength(1);
});

it('never fetches on expand/collapse when explanations are already supplied', () => {
  const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Unexpected network'));
  try {
    render(<AdminWeatherAIResults predictions={[prediction('A', 1)]} />);
    fireEvent.click(button()); fireEvent.click(button()); fireEvent.click(button());
    expect(fetch).not.toHaveBeenCalled();
  } finally { fetch.mockRestore(); }
});
