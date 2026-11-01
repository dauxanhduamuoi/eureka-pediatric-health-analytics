import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import * as api from '@/lib/api';
import AdvancedAnalytics from './AdvancedAnalytics';

vi.mock('@/lib/api', async (original) => ({ ...await original<typeof import('@/lib/api')>(),
  ...Object.fromEntries(['getDashboardPeriods','getDashboardDiseaseGroups','getDiseaseBilingual','getSummaryCard','getTopDiseaseGroupsByMonth','getDiseasePercentageByMonth','getMonthlyComparison','getCasesByGender','getDiseaseByGender','getDiseaseTrend','getYearOverYear'].map((key) => [key,vi.fn()])),
}));
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: {children:ReactNode}) => <div>{children}</div>,
  BarChart: ({data,children}:{data:unknown;children:ReactNode}) => <div><output data-testid="bar-data">{JSON.stringify(data)}</output>{children}</div>,
  LineChart: ({data,children}:{data:unknown;children:ReactNode}) => <div><output data-testid="line-data">{JSON.stringify(data)}</output>{children}</div>,
  PieChart: ({children}:{children:ReactNode}) => <div>{children}</div>,
  Pie: ({data,children}:{data:unknown;children:ReactNode}) => <div><output data-testid="pie-data">{JSON.stringify(data)}</output>{children}</div>,
  Bar: ({dataKey,children}:{dataKey:string;children:ReactNode}) => <div data-series={dataKey}>{children}</div>,
  Line: ({dataKey,connectNulls,strokeOpacity}:{dataKey:string;connectNulls:boolean;strokeOpacity:number}) => <i data-testid="line-series" data-key={dataKey} data-connect={String(connectNulls)} data-opacity={strokeOpacity} />,
  Cell: () => null, Legend: () => null, XAxis: () => null, YAxis: () => null, CartesianGrid: () => null, Tooltip: () => null,
}));
const first = 'Viêm phổi - Pneumonia'; const second = 'Nhóm bệnh có tên rất dài cần được giữ nguyên đầy đủ - Long disease name';
const periods = [{period:'2025-01',year:2025,month:1,season:'Mùa khô'}, {period:'2025-02',year:2025,month:2,season:'Mùa khô'}];
const top = [{period:'2025-02',disease_group:first,case_count:8},{period:'2025-02',disease_group:second,case_count:0}];
const summary:api.SummaryCardResponse = {period:'2025-02',previous_period:'2025-01',total_cases:8,previous_month_cases:4,change_percent:100,trend:'Tăng',season:'Mùa khô',top_3_diseases:top};
const percentages = top.map((r,i)=>({...r,total_cases_in_month:8,percentage:i?0:100}));
const comparison = top.map((r)=>({period:r.period,previous_period:'2025-01',disease_group:r.disease_group,current_cases:r.case_count,previous_cases:4,change_percent:r.case_count?100:-100,trend:r.case_count?'Tăng':'Giảm'}));
const genders = [{period:'2025-02',gender:'Nam',case_count:5,percentage:50},{period:'2025-02',gender:'Nữ',case_count:0,percentage:0},{period:'2025-02',gender:'Khác/không rõ',case_count:5,percentage:50}];
beforeEach(()=>{
  vi.resetAllMocks();localStorage.clear();
  vi.mocked(api.getDashboardPeriods).mockResolvedValue(periods);
  vi.mocked(api.getDashboardDiseaseGroups).mockResolvedValue([{disease_group:first,total_cases:8},{disease_group:second,total_cases:0}]);
  vi.mocked(api.getDiseaseBilingual).mockResolvedValue({});
  vi.mocked(api.getSummaryCard).mockResolvedValue(summary);vi.mocked(api.getTopDiseaseGroupsByMonth).mockResolvedValue(top);
  vi.mocked(api.getDiseasePercentageByMonth).mockResolvedValue(percentages);vi.mocked(api.getMonthlyComparison).mockResolvedValue(comparison);
  vi.mocked(api.getCasesByGender).mockResolvedValue(genders);
  vi.mocked(api.getDiseaseByGender).mockResolvedValue([{disease_group:first,male_cases:4,female_cases:0,other_cases:2,total_cases:6,male_percent:66.7,female_percent:0}]);
  vi.mocked(api.getDiseaseTrend).mockImplementation(async ({diseaseGroup})=>[{period:'2025-01',disease_group:diseaseGroup,case_count:0},{period:'2025-02',disease_group:diseaseGroup,case_count:diseaseGroup===first?8:3}]);
  vi.mocked(api.getYearOverYear).mockImplementation(async (_month,diseaseGroup)=>[{year:2024,month:2,disease_group:diseaseGroup,case_count:0},{year:2025,month:2,disease_group:diseaseGroup,case_count:8}]);
});
const bars = () => screen.getAllByTestId('bar-data').map((n)=>JSON.parse(n.textContent!));
async function mount(mode:'monthly'|'gender'|'trend') {
  render(<AdvancedAnalytics mode={mode} />);
  await waitFor(()=>expect(screen.getByRole('button',{name:'Cập nhật'})).toBeEnabled());
  await waitFor(()=>expect(localStorage.getItem(`sd_chart_cache_advanced_${mode}`)).not.toBeNull());
}
function choosePeriod(label:string,value:string) {
  fireEvent.focus(screen.getByLabelText(label));
  fireEvent.click(screen.getByRole('button',{name:new RegExp(`^${value}`)}));
}

it('monthly keeps four endpoints, summary, original chart rows/zero/order and limit filter',async()=>{
  const frozen=top.map((r)=>Object.freeze({...r}));vi.mocked(api.getTopDiseaseGroupsByMonth).mockResolvedValue(frozen);
  await mount('monthly');
  expect(api.getSummaryCard).toHaveBeenLastCalledWith('2025-02');
  expect(api.getTopDiseaseGroupsByMonth).toHaveBeenLastCalledWith('2025-02',10);
  expect(api.getDiseasePercentageByMonth).toHaveBeenLastCalledWith('2025-02',10);
  expect(api.getMonthlyComparison).toHaveBeenLastCalledWith('2025-02',10);
  expect(bars()[0].map((r:api.TopDiseaseGroupByMonth)=>[r.disease_group,r.case_count])).toEqual(top.map((r)=>[r.disease_group,r.case_count]));
  expect(bars()[1]).toEqual(comparison.map((r)=>({disease_group:r.disease_group.split(' - ')[0],current_cases:r.current_cases,previous_cases:r.previous_cases})));
  expect(JSON.parse(screen.getByTestId('pie-data').textContent!).map((r:{percentage:number})=>r.percentage)).toEqual([100,0]);
  fireEvent.change(screen.getByLabelText('Số nhóm hiển thị'),{target:{value:'20'}});
  await waitFor(()=>expect(api.getMonthlyComparison).toHaveBeenLastCalledWith('2025-02',20));
  choosePeriod('Tìm tháng/năm phân tích','2025-01');
  await waitFor(()=>expect(api.getSummaryCard).toHaveBeenLastCalledWith('2025-01'));
  expect(frozen).toEqual(top);
});

it('monthly error permits retry and empty arrays remain empty without synthetic groups',async()=>{
  vi.mocked(api.getSummaryCard).mockRejectedValueOnce(new Error('Monthly isolated error'));
  render(<AdvancedAnalytics mode="monthly" />);
  expect(await screen.findByText('Monthly isolated error')).toBeVisible();
  vi.mocked(api.getTopDiseaseGroupsByMonth).mockResolvedValue([]);vi.mocked(api.getDiseasePercentageByMonth).mockResolvedValue([]);vi.mocked(api.getMonthlyComparison).mockResolvedValue([]);
  fireEvent.click(screen.getByRole('button',{name:'Cập nhật'}));
  await waitFor(()=>expect(screen.queryByText('Monthly isolated error')).not.toBeInTheDocument());
  expect(screen.getAllByText('Chưa có dữ liệu').length).toBeGreaterThan(0);
  expect(screen.queryByTestId('bar-data')).not.toBeInTheDocument();
});

it('gender preserves independent total/disease scope payloads, zero counts and comparison formula',async()=>{
  await mount('gender');
  expect(api.getCasesByGender).toHaveBeenLastCalledWith({period:'2025-02'});
  expect(api.getDiseaseByGender).toHaveBeenLastCalledWith({period:'2025-02',diseaseGroup:first,limit:1});
  expect(bars()[0]).toEqual(genders);
  expect(JSON.parse(screen.getByTestId('pie-data').textContent!).map((r:{gender:string;case_count:number;percentage:number})=>[r.gender,r.case_count,r.percentage])).toEqual([['Nam',4,66.7],['Khác/không rõ',2,33.3]]);
  fireEvent.change(screen.getByLabelText('Phạm vi thống kê'),{target:{value:'year'}});
  await waitFor(()=>expect(api.getCasesByGender).toHaveBeenLastCalledWith({year:2025}));
  expect(api.getDiseaseByGender).toHaveBeenLastCalledWith({period:'2025-02',diseaseGroup:first,limit:1});
  fireEvent.change(screen.getByLabelText('Phạm vi phân tích'),{target:{value:'all'}});
  await waitFor(()=>expect(api.getDiseaseByGender).toHaveBeenLastCalledWith({diseaseGroup:first,limit:1}));
  fireEvent.change(screen.getByLabelText('Phạm vi thống kê'),{target:{value:'all'}});
  await waitFor(()=>expect(api.getCasesByGender).toHaveBeenLastCalledWith({}));
});

it('gender retains empty comparison and total zero without fabricating categories',async()=>{
  vi.mocked(api.getCasesByGender).mockResolvedValue([{...genders[0],case_count:0,percentage:0}]);vi.mocked(api.getDiseaseByGender).mockResolvedValue([]);
  await mount('gender');expect(bars()[0][0].case_count).toBe(0);expect(screen.getByText('Chưa có dữ liệu phù hợp')).toBeVisible();
  expect(screen.queryByTestId('pie-data')).not.toBeInTheDocument();
});

it('trend preserves per-disease endpoints, sorted pivots, genuine zero and presentation-only highlights',async()=>{
  await mount('trend');
  expect(api.getDiseaseTrend).toHaveBeenLastCalledWith({diseaseGroup:first,startPeriod:'2025-01',endPeriod:'2025-02'});
  expect(api.getYearOverYear).toHaveBeenLastCalledWith(2,first);
  const before=JSON.parse(screen.getByTestId('line-data').textContent!);
  expect(before).toEqual([{period:'2025-01',[first]:0},{period:'2025-02',[first]:8}]);
  expect(screen.getByTestId('line-series')).toHaveAttribute('data-connect','true');
  const calls=vi.mocked(api.getDiseaseTrend).mock.calls.length;
  fireEvent.click(screen.getByRole('button',{name:'Chỉ xem'}));
  expect(api.getDiseaseTrend).toHaveBeenCalledTimes(calls);
  expect(JSON.parse(screen.getByTestId('line-data').textContent!)).toEqual(before);
  fireEvent.click(screen.getByRole('button',{name:'Hiện tất cả'}));
  fireEvent.focus(screen.getByPlaceholderText('Đã chọn 1 nhóm bệnh...'));
  fireEvent.click(screen.getByRole('button',{name:second.split(' - ')[0]}));
  await waitFor(()=>expect(api.getDiseaseTrend).toHaveBeenLastCalledWith({diseaseGroup:second,startPeriod:'2025-01',endPeriod:'2025-02'}));
  await waitFor(()=>expect(screen.getAllByTestId('line-series')).toHaveLength(2));
  expect(JSON.parse(screen.getByTestId('line-data').textContent!)[0]).toEqual({period:'2025-01',[first]:0,[second]:0});
});

it('trend keeps missing observations absent in pivots instead of filling zero',async()=>{
  vi.mocked(api.getDiseaseTrend).mockResolvedValue([{period:'2025-02',disease_group:first,case_count:8}]);
  await mount('trend');expect(JSON.parse(screen.getByTestId('line-data').textContent!)).toEqual([{period:'2025-02',[first]:8}]);
  const cache=JSON.parse(localStorage.getItem('sd_chart_cache_advanced_trend')!);
  expect(cache.trend).toEqual([{period:'2025-02',disease_group:first,case_count:8}]);
});

it('monthly keeps the latest selected-period response and cache after an older response arrives',async()=>{
  let finish!:(value:api.SummaryCardResponse)=>void;
  vi.mocked(api.getSummaryCard).mockImplementationOnce(()=>new Promise((done)=>{finish=done;})).mockResolvedValueOnce({...summary,period:'2025-01',total_cases:99});
  render(<AdvancedAnalytics mode="monthly" />);
  await waitFor(()=>expect(api.getSummaryCard).toHaveBeenCalledTimes(1));
  choosePeriod('Tìm tháng/năm phân tích','2025-01');
  await waitFor(()=>expect(localStorage.getItem('sd_chart_cache_advanced_monthly')).toContain('99'));
  await act(async()=>finish(summary));
  expect(JSON.parse(localStorage.getItem('sd_chart_cache_advanced_monthly')!).summary.period).toBe('2025-01');
  expect(JSON.parse(localStorage.getItem('sd_chart_cache_advanced_monthly')!).summary.total_cases).toBe(99);
});

it('monthly exposes all comparison rows and missing change values without turning them into zero',async()=>{
  vi.mocked(api.getSummaryCard).mockResolvedValue({...summary,change_percent:null,top_3_diseases:[]});
  vi.mocked(api.getMonthlyComparison).mockResolvedValue([{...comparison[0],change_percent:null},comparison[1]]);
  await mount('monthly');
  const table=within(screen.getByRole('region',{name:'Đối chiếu nhóm bệnh theo tháng'}));
  expect(table.getAllByRole('row')).toHaveLength(3);
  expect(table.getByText('-')).toBeVisible();
  expect(table.getByText(second.split(' - ')[0])).toBeVisible();
  expect(table.getByRole('cell',{name:'0'})).toBeVisible();
  const update=screen.getByRole('button',{name:'Cập nhật'});update.focus();expect(update).toHaveFocus();
});

it('gender changing only the disease keeps total scope and does not fabricate a missing comparison',async()=>{
  await mount('gender');
  fireEvent.focus(screen.getByLabelText('Nhóm bệnh cần phân tích'));
  fireEvent.click(screen.getByRole('button',{name:second.split(' - ')[0]}));
  await waitFor(()=>expect(api.getDiseaseByGender).toHaveBeenLastCalledWith({period:'2025-02',diseaseGroup:second,limit:1}));
  expect(api.getCasesByGender).toHaveBeenLastCalledWith({period:'2025-02'});
  const table=within(screen.getByRole('region',{name:'Số liệu tổng theo giới tính'}));
  expect(table.getAllByRole('row')).toHaveLength(4);
  expect(table.getByRole('cell',{name:'0'})).toBeVisible();
});

it('trend tables retain missing cells as absent values and do not change highlight data or cache schema',async()=>{
  vi.mocked(api.getDiseaseTrend).mockImplementation(async({diseaseGroup})=>diseaseGroup===first?[{period:'2025-01',disease_group:first,case_count:0}]:[{period:'2025-02',disease_group:second,case_count:3}]);
  await mount('trend');
  fireEvent.focus(screen.getByPlaceholderText('Đã chọn 1 nhóm bệnh...'));fireEvent.click(screen.getByRole('button',{name:second.split(' - ')[0]}));
  await waitFor(()=>expect(screen.getAllByTestId('line-series')).toHaveLength(2));
  const graph=JSON.parse(screen.getByTestId('line-data').textContent!);
  expect(graph).toEqual([{period:'2025-01',[first]:0},{period:'2025-02',[second]:3}]);
  const table=within(screen.getByRole('region',{name:'Dữ liệu chuỗi xu hướng'}));expect(table.getAllByText('—')).toHaveLength(2);
  const cache=JSON.parse(localStorage.getItem('sd_chart_cache_advanced_trend')!);expect(cache.selectedDiseases).toEqual([first,second]);
  expect(cache.trend).toHaveLength(2);expect(cache.limit).toBe(10);
  const region=screen.getByRole('region',{name:'Dữ liệu chuỗi xu hướng'});region.focus();expect(region).toHaveFocus();
});

it('ignores stale errors while the latest monthly request completes and permits retry',async()=>{
  let reject!:(error:Error)=>void;let finish!:(value:api.SummaryCardResponse)=>void;
  vi.mocked(api.getSummaryCard).mockImplementationOnce(()=>new Promise((_r,b)=>{reject=b;})).mockImplementationOnce(()=>new Promise((a)=>{finish=a;}));
  render(<AdvancedAnalytics mode="monthly" />);await waitFor(()=>expect(api.getSummaryCard).toHaveBeenCalledTimes(1));
  choosePeriod('Tìm tháng/năm phân tích','2025-01');await waitFor(()=>expect(api.getSummaryCard).toHaveBeenCalledTimes(2));
  await act(async()=>reject(new Error('stale error')));
  expect(screen.queryByText('stale error')).not.toBeInTheDocument();expect(screen.getByRole('button',{name:'Cập nhật'})).toBeDisabled();
  await act(async()=>finish({...summary,period:'2025-01'}));expect(screen.getByRole('button',{name:'Cập nhật'})).toBeEnabled();
});

it('keeps a previous monthly cache schema and cached zero while background requests are pending',async()=>{
  const view=render(<AdvancedAnalytics mode="monthly" />);
  await waitFor(()=>expect(localStorage.getItem('sd_chart_cache_advanced_monthly')).not.toBeNull());
  const saved=JSON.parse(localStorage.getItem('sd_chart_cache_advanced_monthly')!);view.unmount();
  saved.selectedPeriod='2025-01';saved.limit=20;saved.summary={...summary,total_cases:0};
  localStorage.setItem('sd_chart_cache_advanced_monthly',JSON.stringify(saved));
  vi.mocked(api.getSummaryCard).mockReturnValue(new Promise(()=>{}));vi.mocked(api.getDashboardPeriods).mockReturnValue(new Promise(()=>{}));
  render(<AdvancedAnalytics mode="monthly" />);
  expect(bars()[0].map((r:api.TopDiseaseGroupByMonth)=>r.case_count)).toEqual([8,0]);
  await waitFor(()=>expect(api.getSummaryCard).toHaveBeenLastCalledWith('2025-01'));
  expect(api.getMonthlyComparison).toHaveBeenLastCalledWith('2025-01',20);
  const current=JSON.parse(localStorage.getItem('sd_chart_cache_advanced_monthly')!);
  expect(Object.keys(current).sort()).toEqual(Object.keys(saved).sort());expect(current.summary.total_cases).toBe(0);
  expect(screen.getByRole('button',{name:'Cập nhật'})).toBeDisabled();
});
