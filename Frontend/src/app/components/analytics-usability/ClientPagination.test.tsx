import { fireEvent, render, screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import { ClientPagination, PagedRows, useClientPage } from './ClientPagination';

const source = Object.freeze(Array.from({ length: 23 }, (_, i) => i));
function Probe({ rows = source, context = 'first' }: { rows?: readonly number[]; context?: string }) {
  const paging = useClientPage(rows, context, 5);
  return <><output>{paging.rows.join(',')}</output><ClientPagination label="fixture" paging={paging} chooseSize /></>;
}
it('pages every item in order without modifying input and keeps native keyboard controls', () => {
  render(<Probe />); const seen: number[] = [];
  for (let page = 0; page < 5; page++) {
    seen.push(...screen.getByRole('status').textContent!.split(',').map(Number));
    if (page < 4) fireEvent.click(screen.getByRole('button', { name: 'Tiếp' }));
  }
  expect(seen).toEqual(source); expect(screen.getByText('21–23 / 23 mục')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Tiếp' })).toBeDisabled();
  const back = screen.getByRole('button', { name: 'Trước' }); back.focus(); expect(back).toHaveFocus();
});
it('resets on filter changes, clamps a shorter list and resets page after changing size', () => {
  const view = render(<Probe />); fireEvent.click(screen.getByRole('button', { name: 'Tiếp' }));
  view.rerender(<Probe context="second" />); expect(screen.getByText('Trang 1 / 5')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Tiếp' })); view.rerender(<Probe rows={[0]} context="second" />);
  expect(screen.getByText('1–1 / 1 mục')).toBeVisible();
  view.rerender(<Probe />); fireEvent.click(screen.getByRole('button', { name: 'Tiếp' }));
  fireEvent.change(screen.getByRole('combobox'), { target: { value: '10' } }); expect(screen.getByText('1–10 / 23 mục')).toBeVisible();
});
it('does not fabricate rows in an empty collection', () => {
  render(<Probe rows={[]} />); expect(screen.getByText('0–0 / 0 mục')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Trước' })).toBeDisabled(); expect(screen.getByRole('button', { name: 'Tiếp' })).toBeDisabled();
});
it('resets a table when its source identity changes and keeps local horizontal-scroll semantics', () => {
  const makeRows = (values: readonly number[]) => values.map(v => <tr key={v}><td>{v}</td></tr>);
  const view = render(<PagedRows label="Rows" source={source} rows={makeRows(source)} headings={['Value']} />);
  fireEvent.click(within(screen.getByRole('navigation')).getByRole('button', { name: 'Tiếp' }));
  const short = [0]; view.rerender(<PagedRows label="Rows" source={short} rows={makeRows(short)} headings={['Value']} />);
  expect(screen.getByText('1–1 / 1 mục')).toBeVisible(); expect(screen.getByRole('region', { name: 'Rows' })).toHaveAttribute('tabindex', '0');
  expect(screen.getByRole('cell', { name: '0' })).toBeVisible();
});
