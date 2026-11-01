import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/lib/i18n';
import * as notifications from '@/lib/notifications';
import * as api from '@/lib/api';
import NotificationsPanel from './NotificationsPanel';

vi.mock('@/lib/notifications',async(original)=>({...await original<typeof import('@/lib/notifications')>(),refreshRiskNotifications:vi.fn()}));
const items:notifications.AppNotification[]=[
  {id:'a',type:'high-risk',severity:'critical',title:'Cảnh báo tổng hợp kiểm thử',description:'Nội dung nguyên vẹn từ nguồn thông báo.',createdAt:'2026-10-01T07:00:00Z',read:false},
  {id:'b',type:'forecast',severity:'info',title:'Dự báo kiểm thử',createdAt:'2026-10-02T07:00:00Z',read:true},
  {id:'c',type:'import',severity:'warning',title:'Import kiểm thử',description:'Tên nội dung dài '.repeat(20),createdAt:'2026-10-03T07:00:00Z',read:false},
  {id:'d',type:'system',severity:'info',title:'Hệ thống kiểm thử',createdAt:'2026-10-04T07:00:00Z',read:false},
];
beforeEach(()=>{vi.resetAllMocks();localStorage.clear();localStorage.setItem('sd_notifications',JSON.stringify(items));vi.mocked(notifications.refreshRiskNotifications).mockResolvedValue(0);});
const mount=()=>render(<I18nProvider><NotificationsPanel /></I18nProvider>);
async function loaded(){mount();await waitFor(()=>expect(screen.getByRole('button',{name:'Đồng bộ'})).toBeEnabled());}
const rows=()=>screen.getAllByRole('listitem');
function readButton(row:HTMLElement){const scoped=within(row);return scoped.queryByRole('button',{name:/Đánh dấu/})??scoped.getAllByRole('button')[0];}
const clearButton=()=>screen.getByRole('button',{name:'Xóa hết'});

it('keeps initial order, titles, exact descriptions and local storage while synchronizing',async()=>{
  await loaded();expect(rows()).toHaveLength(4);
  expect(rows().map((r)=>r.querySelector('h4,h3')?.textContent)).toEqual(items.map((n)=>n.title));
  expect(rows()[0].querySelector('p')?.textContent).toBe(items[0].description);expect(rows()[2].querySelector('p')?.textContent).toBe(items[2].description);
  expect(notifications.loadNotifications()).toEqual(items);expect(notifications.refreshRiskNotifications).toHaveBeenCalledTimes(1);
});

it('filters unread and each existing notification type without changing persisted data',async()=>{
  await loaded();fireEvent.click(screen.getByRole('button',{name:/^Chưa đọc/}));expect(rows()).toHaveLength(3);
  for(const [name,title] of [['Rủi ro cao',items[0].title],['Dự báo',items[1].title],['Import',items[2].title],['Hệ thống',items[3].title]]){
    fireEvent.click(screen.getByRole('button',{name:new RegExp(`^${name}`)}));expect(rows()).toHaveLength(1);expect(rows()[0]).toHaveTextContent(title);
  }
  fireEvent.click(screen.getByRole('button',{name:/^Tất cả/}));expect(rows()).toHaveLength(4);expect(notifications.loadNotifications()).toEqual(items);
});

it('marks one read and removes only the chosen item, including from an unread filter',async()=>{
  await loaded();fireEvent.click(screen.getByRole('button',{name:/^Chưa đọc/}));
  fireEvent.click(readButton(rows()[0]));expect(screen.queryByRole('heading',{name:items[0].title})).not.toBeInTheDocument();
  expect(notifications.loadNotifications().find((n)=>n.id==='a')?.read).toBe(true);
  const row=screen.getByRole('heading',{name:items[2].title}).closest('li')!;
  fireEvent.click(within(row).getAllByRole('button').at(-1)!);
  expect(notifications.loadNotifications().map((n)=>n.id)).toEqual(['a','b','d']);
  expect(rows()).toHaveLength(1);
});

it('keeps mark-all and clear confirmation behavior with isolated browser storage only',async()=>{
  await loaded();fireEvent.click(screen.getByRole('button',{name:'Đánh dấu đã đọc'}));expect(notifications.loadNotifications().every((n)=>n.read)).toBe(true);
  expect(screen.getByRole('button',{name:'Đánh dấu đã đọc'})).toBeDisabled();
  const confirm=vi.spyOn(window,'confirm').mockReturnValue(false);fireEvent.click(clearButton());expect(rows()).toHaveLength(4);
  confirm.mockReturnValue(true);fireEvent.click(clearButton());expect(notifications.loadNotifications()).toEqual([]);
  expect(screen.getByText('Không có thông báo.')).toBeVisible();expect(clearButton()).toBeDisabled();
  confirm.mockRestore();
});

it('keeps loading state and permits repeated synchronization without deleting existing content',async()=>{
  let finish!:(n:number)=>void;vi.mocked(notifications.refreshRiskNotifications).mockReturnValueOnce(new Promise((done)=>{finish=done;}));
  mount();expect(screen.getByRole('button',{name:'Đồng bộ'})).toBeDisabled();expect(rows()).toHaveLength(4);
  await act(async()=>finish(0));expect(screen.getByRole('button',{name:'Đồng bộ'})).toBeEnabled();
  fireEvent.click(screen.getByRole('button',{name:'Đồng bộ'}));await waitFor(()=>expect(notifications.refreshRiskNotifications).toHaveBeenCalledTimes(2));
  expect(notifications.loadNotifications()).toEqual(items);
});

it('handles an empty inbox and empty type filter without inventing notification content',async()=>{
  localStorage.setItem('sd_notifications','[]');await loaded();expect(screen.getByText('Không có thông báo.')).toBeVisible();
  expect(screen.queryByRole('listitem')).not.toBeInTheDocument();expect(screen.getByRole('button',{name:'Đánh dấu đã đọc'})).toBeDisabled();
});

it('shows a propagated sync failure without claiming success and permits retry with stored content intact',async()=>{
  vi.mocked(notifications.refreshRiskNotifications).mockRejectedValueOnce(new Error('isolated failure'));
  mount();expect(await screen.findByRole('alert')).toHaveTextContent('Không thể đồng bộ thông báo. Vui lòng thử lại.');
  expect(screen.queryByText(/Đồng bộ lúc/)).not.toBeInTheDocument();expect(notifications.loadNotifications()).toEqual(items);
  fireEvent.click(screen.getByRole('button',{name:'Đồng bộ'}));
  await waitFor(()=>expect(screen.queryByRole('alert')).not.toBeInTheDocument());expect(rows()).toHaveLength(4);
});

it('keeps empty titles/descriptions in storage and presents a safe placeholder with labelled actions',async()=>{
  const sparse={...items[0],title:'',description:undefined,createdAt:''};localStorage.setItem('sd_notifications',JSON.stringify([sparse]));
  await loaded();expect(screen.getByRole('heading',{name:'Thông báo chưa có tiêu đề'})).toBeVisible();expect(screen.getByText('Chưa có thời gian')).toBeVisible();
  const button=screen.getByRole('button',{name:'Đánh dấu đã đọc: Thông báo chưa có tiêu đề'});button.focus();expect(button).toHaveFocus();
  expect(notifications.loadNotifications()[0].title).toBe('');expect(notifications.loadNotifications()[0].description).toBeUndefined();
});

it('documents the existing shared helper contract: provider failures return zero without propagating',async()=>{
  const actual=await vi.importActual<typeof import('@/lib/notifications')>('@/lib/notifications');
  const provider=vi.spyOn(api,'getForecastGroupSummary').mockRejectedValueOnce(new Error('isolated provider error'));
  expect(await actual.refreshRiskNotifications()).toBe(0);expect(notifications.loadNotifications()).toEqual(items);provider.mockRestore();
});
