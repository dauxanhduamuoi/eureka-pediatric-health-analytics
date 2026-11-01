import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/lib/i18n';
import * as api from '@/lib/api';
import { addNotification } from '@/lib/notifications';
import { downloadReport } from '@/lib/reports';
import Forecast from './Forecast';
import viStrings from '@/i18n/locales/vi';

vi.mock('@/lib/api',async(original)=>({...await original<typeof import('@/lib/api')>(),getDiseaseBilingual:vi.fn(),getForecastGroupSummary:vi.fn(),getForecastResults:vi.fn(),runForecast:vi.fn()}));
vi.mock('@/lib/notifications',()=>({addNotification:vi.fn()}));
vi.mock('@/lib/reports',async(original)=>({...await original<typeof import('@/lib/reports')>(),downloadReport:vi.fn(()=>({filename:'isolated.csv',sizeBytes:10,mime:'text/csv;charset=utf-8'}))}));
vi.mock('recharts',()=>({
 ResponsiveContainer:({children}:{children:ReactNode})=><div>{children}</div>,
 BarChart:({data,children}:{data:unknown;children:ReactNode})=><div><output data-testid="forecast-chart-data">{JSON.stringify(data)}</output>{children}</div>,
 Bar:({dataKey,children}:{dataKey:string;children:ReactNode})=><div data-testid="forecast-series" data-key={dataKey}>{children}</div>,
 XAxis:()=>null,YAxis:()=>null,Tooltip:()=>null,Legend:()=>null,CartesianGrid:()=>null,Cell:()=>null,LabelList:()=>null,
}));
const rows:api.ForecastGroupSummary[]=[
 {forecast_period:'2026-10',disease_group:'Nhóm B',previous_cases:5,predicted_cases:2,change_percent:-60,trend:'Giảm',risk_level:'Thấp'},
 {forecast_period:'2026-10',disease_group:'Nhóm A',previous_cases:0,predicted_cases:0,change_percent:null,trend:'Ổn định',risk_level:'Thấp'},
 {forecast_period:'2026-10',disease_group:'Nhóm C',previous_cases:3,predicted_cases:10,change_percent:233.3,trend:'Tăng',risk_level:'Cao'},
];
beforeEach(()=>{vi.resetAllMocks();localStorage.clear();vi.mocked(api.getDiseaseBilingual).mockResolvedValue({});vi.mocked(api.getForecastGroupSummary).mockResolvedValue(rows);vi.mocked(api.getForecastResults).mockResolvedValue([]);vi.mocked(api.runForecast).mockResolvedValue({message:'ok',result:{}});vi.mocked(downloadReport).mockReturnValue({filename:'isolated.csv',sizeBytes:10,mime:'text/csv;charset=utf-8'});});
const mount=()=>render(<I18nProvider><Forecast /></I18nProvider>);
async function loaded(){mount();await screen.findByTestId('forecast-chart-data');}
const chart=()=>JSON.parse(screen.getByTestId('forecast-chart-data').textContent!);
const input=(label:string,index:number)=>screen.queryByRole('textbox',{name:label})??screen.getAllByRole('textbox')[index];

it('preserves sorted chart data, observed/forecast series, totals, zero and raw input order',async()=>{
 const frozen=rows.map((r)=>Object.freeze({...r}));vi.mocked(api.getForecastGroupSummary).mockResolvedValueOnce(frozen);await loaded();
 expect(chart()).toEqual([{name:'Nhóm C',predicted:10,previous:3,risk:'Cao'},{name:'Nhóm B',predicted:2,previous:5,risk:'Thấp'},{name:'Nhóm A',predicted:0,previous:0,risk:'Thấp'}]);
 expect(screen.getAllByTestId('forecast-series').map((e)=>e.dataset.key)).toEqual(['previous','predicted']);
 expect(JSON.parse(localStorage.getItem('sd_chart_cache_forecast')!).summary).toEqual(rows);expect(frozen).toEqual(rows);
});

it('keeps local risk/search filters, table search, CSV rows and cache fields without refetching',async()=>{
 await loaded();fireEvent.click(screen.getByRole('button',{name:'Cao'}));await waitFor(()=>expect(chart()).toHaveLength(1));
 expect(api.getForecastGroupSummary).toHaveBeenCalledTimes(1);
 fireEvent.click(screen.getByRole('button',{name:'Tất cả'}));
 fireEvent.change(input('Lọc nhóm bệnh trong kết quả',0),{target:{value:'Nhóm B'}});await waitFor(()=>expect(chart()[0].name).toBe('Nhóm B'));
 fireEvent.click(screen.getByRole('button',{name:'Xuất CSV'}));expect(downloadReport).toHaveBeenCalledTimes(1);
 expect(vi.mocked(downloadReport).mock.calls[0][0].rows).toHaveLength(1);
 const cache=JSON.parse(localStorage.getItem('sd_chart_cache_forecast')!);expect(Object.keys(cache).sort()).toEqual(['summary','details','riskFilter','searchTerm','summarySearchTerm','selectedPeriod','summaryPage','summaryPageSize','summaryCustomSize'].sort());
});

it('keeps summary pagination and custom-size values without changing API calls',async()=>{
 vi.mocked(api.getForecastGroupSummary).mockResolvedValue(Array.from({length:25},(_,i)=>({...rows[0],disease_group:`Nhóm ${i}`})));await loaded();
 const pageSize=screen.getByLabelText('Mỗi trang');fireEvent.change(pageSize,{target:{value:'10'}});
 const main=screen.getAllByRole('table')[0];expect(within(main).getAllByRole('row')).toHaveLength(11);
 fireEvent.click(screen.queryByRole('button',{name:'Trang sau'})??screen.getByRole('button',{name:'›'}));
 expect(within(main).getByText('Nhóm 10')).toBeVisible();expect(api.getForecastGroupSummary).toHaveBeenCalledTimes(1);
 fireEvent.change(pageSize,{target:{value:'custom'}});const custom=screen.getByRole('spinbutton');fireEvent.change(custom,{target:{value:'3'}});
 expect(within(main).getAllByRole('row')).toHaveLength(4);
});

it('retains grouped age details and existing age-group ordering',async()=>{
 vi.mocked(api.getForecastResults).mockResolvedValue([{...rows[0],id:2,age_group:'6-10 tuổi'},{...rows[0],id:1,age_group:'Dưới 1 tuổi'}, {...rows[0],id:3,age_group:'6-11 tháng'},{...rows[0],id:4,age_group:'0-5 tháng'}]);
 await loaded();fireEvent.click(screen.getByText('Nhóm B'));
 const tables=screen.getAllByRole('table');expect(tables).toHaveLength(2);
 const body=within(tables[1]).getAllByRole('row');expect(body[1]).toHaveTextContent('Dưới 1 tuổi');expect(body[2]).toHaveTextContent('6-10 tuổi');
 expect(body[3]).toHaveTextContent('6-11 tháng');expect(body[4]).toHaveTextContent('0-5 tháng');
});

it('keeps POST failures explicit and retries without success notifications',async()=>{
 await loaded();vi.mocked(api.runForecast).mockRejectedValueOnce(new Error('POST isolated error'));
 fireEvent.click(screen.getByRole('button',{name:'Chạy dự báo'}));expect(await screen.findByText('POST isolated error')).toBeVisible();
 expect(addNotification).not.toHaveBeenCalledWith(expect.objectContaining({severity:'info'}));
 expect(screen.getByRole('button',{name:'Chạy dự báo'})).toBeEnabled();expect(api.runForecast).toHaveBeenCalledWith('auto',1);
});

it('invalidates pending runs on unmount without new cache writes or completion notices',async()=>{
 let finish!:(value:{message:string;result:object})=>void;vi.mocked(api.runForecast).mockReturnValueOnce(new Promise((done)=>{finish=done;}));
 const view=mount();await screen.findByTestId('forecast-chart-data');fireEvent.click(screen.getByRole('button',{name:'Chạy dự báo'}));
 const cache=localStorage.getItem('sd_chart_cache_forecast');view.unmount();await act(async()=>finish({message:'ok',result:{}}));
 expect(addNotification).not.toHaveBeenCalled();expect(localStorage.getItem('sd_chart_cache_forecast')).toBe(cache);
 expect(api.getForecastGroupSummary).toHaveBeenCalledTimes(1);
});

it('does not label an unread API failure as a confirmed empty forecast',async()=>{
 vi.mocked(api.getForecastGroupSummary).mockRejectedValueOnce(new Error('Initial read fixture'));
 mount();expect(await screen.findByRole('alert')).toHaveTextContent('Initial read fixture');
 expect(screen.queryByText(viStrings['forecast.empty'])).not.toBeInTheDocument();
 expect(localStorage.getItem('sd_chart_cache_forecast')).toBeNull();expect(addNotification).not.toHaveBeenCalled();
});
