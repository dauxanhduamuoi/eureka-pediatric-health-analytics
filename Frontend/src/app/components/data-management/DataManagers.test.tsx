import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import * as api from '@/lib/api';
import DiseaseCodesManager from '../DiseaseCodesManager';
import ProvinceRegionsManager from '../ProvinceRegionsManager';
import ParentGuideManager from '../ParentGuideManager';
import { clearAreaInsightsCache } from '@/lib/areaInsightsCache';
import { clearChartDataCaches } from '@/lib/chartDataCache';

vi.mock('@/lib/api',async(original)=>({...await original<typeof import('@/lib/api')>(),...Object.fromEntries(['getDiseaseCodesStatus','listDiseaseCodes','importDiseaseCodes','getProvinceRegionsStatus','previewProvinceRegions','importProvinceRegions','getParentGuideStatus','previewParentGuide','importParentGuide','listParentGuide'].map((k)=>[k,vi.fn()]))}));
vi.mock('@/lib/areaInsightsCache',()=>({clearAreaInsightsCache:vi.fn()}));
vi.mock('@/lib/chartDataCache',()=>({clearChartDataCaches:vi.fn()}));
const codes:api.DiseaseCodeRow[]=Array.from({length:60},(_,i)=>({id:i,icd_code:`SYN-${i}`,disease_name:`Mẫu bệnh ${i}`,group_id:i%2?null:'G1',group_name:i%2?null:'Nhóm mẫu',report_group_code:null,english_name:null,missing_group:Boolean(i%2)}));
const guideRows=[{id:1,title:'Hướng dẫn mẫu',disease_group:'Nhóm hướng dẫn kiểm thử',symptoms:'Nội dung mẫu dòng 1\nNội dung mẫu dòng 2',warning_signs:'Chuỗi cảnh báo kiểm thử.',prevention:'Chuỗi phòng bệnh kiểm thử.'}];
const preview:api.ProvinceRegionsPreview={sheet:'Sheet1',columns:['province_code','province_name','mien_code','mien'],required_columns:['province_code','province_name','mien_code','mien'],missing_columns:[],total_rows:1,valid_rows:1,invalid_rows:0,sample_rows:[{province_code:'SYN',province_name:'Tỉnh mẫu',mien_code:'south',mien:'Miền Nam'}]};
beforeEach(()=>{
 vi.resetAllMocks();localStorage.clear();
 vi.mocked(api.getDiseaseCodesStatus).mockResolvedValue({has_disease_codes:true,total_codes:60,distinct_groups:1,uploaded_file:'fixture_codes.xlsx'});
 vi.mocked(api.listDiseaseCodes).mockImplementation(async(p={})=>{const all=codes.filter(r=>(!p.onlyMissingGroup||r.missing_group)&&(!p.search||r.icd_code.includes(p.search)));return {total:all.length,limit:p.limit??25,offset:p.offset??0,missing_group_total:30,rows:all.slice(p.offset??0,(p.offset??0)+(p.limit??25))};});
 vi.mocked(api.getProvinceRegionsStatus).mockResolvedValue({has_province_regions:true,total_rows:1,uploaded_file:'fixture_regions.xlsx'});
 vi.mocked(api.previewProvinceRegions).mockResolvedValue(preview);vi.mocked(api.importProvinceRegions).mockResolvedValue({message:'Import kiểm thử',result:{total_rows:1,saved_rows:1,invalid_rows:0}});
 vi.mocked(api.getParentGuideStatus).mockResolvedValue({has_parent_guide:true,total_rows:1,uploaded_file:'fixture_guides.xlsx'});
 vi.mocked(api.previewParentGuide).mockResolvedValue({...preview,duplicate_groups_removed:0});vi.mocked(api.importParentGuide).mockResolvedValue({message:'Import kiểm thử',result:{total_rows:1,saved_rows:1,invalid_rows:0}});
 vi.mocked(api.listParentGuide).mockResolvedValue({total:1,limit:10,offset:0,rows:guideRows});
});
const file=(name='fixture.xlsx',bytes='isolated fixture')=>new File([bytes],name);
function selectFile(container:HTMLElement,f:File){fireEvent.change(container.querySelector('input[type="file"]')!,{target:{files:[f]}});}
async function openCodes(){render(<DiseaseCodesManager />);expect(api.listDiseaseCodes).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:/Mở danh sách mã bệnh/}));await screen.findByText('SYN-0');}

it('disease keeps lazy loading, server filter/pagination payloads, null fields and row order',async()=>{
 await openCodes();expect(api.listDiseaseCodes).toHaveBeenLastCalledWith({search:undefined,onlyMissingGroup:false,limit:25,offset:0});
 fireEvent.click(screen.queryByRole('button',{name:'Trang sau'})??screen.getByRole('button',{name:'›'}));
 await waitFor(()=>expect(api.listDiseaseCodes).toHaveBeenLastCalledWith({search:undefined,onlyMissingGroup:false,limit:25,offset:25}));
 fireEvent.click(screen.getByLabelText('Chỉ xem mã thiếu nhóm bệnh'));await waitFor(()=>expect(api.listDiseaseCodes).toHaveBeenLastCalledWith({search:undefined,onlyMissingGroup:true,limit:25,offset:0}));
 fireEvent.change(screen.getByPlaceholderText(/^Tìm MAICD/),{target:{value:'SYN-1'}});await waitFor(()=>expect(api.listDiseaseCodes).toHaveBeenLastCalledWith({search:'SYN-1',onlyMissingGroup:true,limit:25,offset:0}));
 expect(api.importDiseaseCodes).not.toHaveBeenCalled();
});
it('disease keeps permission failures visible and allows read retry',async()=>{
 vi.mocked(api.listDiseaseCodes).mockRejectedValueOnce(new api.ApiError(403,'Codes forbidden fixture'));
 render(<DiseaseCodesManager />);fireEvent.click(screen.getByRole('button',{name:/Mở danh sách mã bệnh/}));expect(await screen.findByText('Codes forbidden fixture')).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Làm mới mã bệnh'}));await screen.findByText('SYN-0');expect(screen.queryByText('Codes forbidden fixture')).not.toBeInTheDocument();
});
it('disease ignores an old search response after the latest query',async()=>{
 let finish!:(r:api.DiseaseCodesListResponse)=>void;vi.mocked(api.listDiseaseCodes).mockReturnValueOnce(new Promise(done=>{finish=done;}));
 render(<DiseaseCodesManager />);fireEvent.click(screen.getByRole('button',{name:/Mở danh sách mã bệnh/}));
 fireEvent.change(screen.getByPlaceholderText(/^Tìm MAICD/),{target:{value:'SYN-10'}});await screen.findByText('SYN-10');
 await act(async()=>finish({total:1,limit:25,offset:0,missing_group_total:0,rows:[{...codes[0],icd_code:'STALE-CODE'}]}));expect(screen.queryByText('STALE-CODE')).not.toBeInTheDocument();expect(screen.getByText('SYN-10')).toBeVisible();
});

it('regions preserves preview/file identity, explicit import, cancel, and validation blocking',async()=>{
 const view=render(<ProvinceRegionsManager />);const f=file();selectFile(view.container,f);expect(await screen.findByText('Đã kiểm tra file: 1 tỉnh/thành hợp lệ.')).toBeVisible();
 expect(api.previewProvinceRegions).toHaveBeenCalledWith(f);expect(api.importProvinceRegions).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Hủy'}));expect(screen.queryByRole('button',{name:'Import file này'})).not.toBeInTheDocument();
 vi.mocked(api.previewProvinceRegions).mockResolvedValueOnce({...preview,missing_columns:['mien_code']});selectFile(view.container,f);
 expect(await screen.findByText('File thiếu cột: mien_code')).toBeVisible();expect(screen.getByRole('button',{name:'Import file này'})).toBeDisabled();
});
it('regions keeps mapping samples and import failure/retry semantics without rewriting data',async()=>{
 const view=render(<ProvinceRegionsManager />);const f=file();selectFile(view.container,f);await screen.findByText('Đã kiểm tra file: 1 tỉnh/thành hợp lệ.');
 fireEvent.click(screen.getByRole('button',{name:'Xem mẫu dữ liệu'}));expect(screen.getByText('Tỉnh mẫu')).toBeVisible();expect(screen.getAllByText('Miền Nam').length).toBeGreaterThan(0);
 vi.mocked(api.importProvinceRegions).mockRejectedValueOnce(new api.ApiError(409,'Mapping conflict fixture'));fireEvent.click(screen.getByRole('button',{name:'Import file này'}));
 expect(await screen.findByText('Mapping conflict fixture')).toBeVisible();expect(api.importProvinceRegions).toHaveBeenLastCalledWith(f);
 fireEvent.click(screen.getByRole('button',{name:'Import file này'}));expect(await screen.findByText('Import kiểm thử Đã lưu 1 tỉnh/thành.')).toBeVisible();
 expect(clearAreaInsightsCache).toHaveBeenCalledTimes(2);expect(clearChartDataCaches).toHaveBeenCalledTimes(2);
});
it('regions rejects invalid/empty fixture files via existing provider validation without fake success',async()=>{
 vi.mocked(api.previewProvinceRegions).mockRejectedValueOnce(new api.ApiError(400,'Invalid file fixture'));
 const view=render(<ProvinceRegionsManager />);const bad=file('invalid.txt','');selectFile(view.container,bad);expect(await screen.findByText('Invalid file fixture')).toBeVisible();
 expect(api.previewProvinceRegions).toHaveBeenCalledWith(bad);expect(screen.queryByRole('button',{name:'Import file này'})).not.toBeInTheDocument();expect(api.importProvinceRegions).not.toHaveBeenCalled();
});

it('guides keeps medical text unchanged, list request/page-size and search payload',async()=>{
 render(<ParentGuideManager />);fireEvent.click(screen.getByRole('button',{name:'Xem dữ liệu đã import'}));await screen.findByText('Nhóm hướng dẫn kiểm thử');
 expect(api.listParentGuide).toHaveBeenLastCalledWith({search:undefined,limit:10,offset:0});
 const content=screen.getByText((_t,e)=>e?.childElementCount===0&&e.textContent===guideRows[0].symptoms);expect(content.textContent).toBe(guideRows[0].symptoms);
 expect(screen.getByText(guideRows[0].warning_signs).textContent).toBe(guideRows[0].warning_signs);expect(screen.getByText(guideRows[0].prevention).textContent).toBe(guideRows[0].prevention);
 fireEvent.change(screen.getByPlaceholderText(/^Tìm tên nhóm bệnh/),{target:{value:'không có'}});await waitFor(()=>expect(api.listParentGuide).toHaveBeenLastCalledWith({search:'không có',limit:10,offset:0}));
 fireEvent.change(screen.getByRole('combobox'),{target:{value:'25'}});await waitFor(()=>expect(api.listParentGuide).toHaveBeenLastCalledWith({search:'không có',limit:25,offset:0}));
});
it('guides keeps validation, cancel and import file payload while rendering write failures',async()=>{
 const view=render(<ParentGuideManager />);const f=file();selectFile(view.container,f);await screen.findByText('Đã kiểm tra file: 1 dòng hợp lệ.');
 fireEvent.click(screen.getByRole('button',{name:'Hủy'}));expect(api.importParentGuide).not.toHaveBeenCalled();selectFile(view.container,f);await screen.findByText('Đã kiểm tra file: 1 dòng hợp lệ.');
 vi.mocked(api.importParentGuide).mockRejectedValueOnce(new api.ApiError(500,'Guide write fixture'));fireEvent.click(screen.getByRole('button',{name:'Import file này'}));expect(await screen.findByText('Guide write fixture')).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Import file này'}));expect(await screen.findByText('Import kiểm thử Đã lưu 1 nhóm bệnh.')).toBeVisible();expect(api.importParentGuide).toHaveBeenLastCalledWith(f);
});
it('guides keeps list API failures and a legitimate empty response distinct from content',async()=>{
 vi.mocked(api.listParentGuide).mockRejectedValueOnce(new api.ApiError(401,'Guide unauthorized fixture'));
 render(<ParentGuideManager />);fireEvent.click(screen.getByRole('button',{name:'Xem dữ liệu đã import'}));expect(await screen.findByText('Guide unauthorized fixture')).toBeVisible();
 expect(screen.queryByText('Hiển thị 0-0 / 0')).not.toBeInTheDocument();expect(screen.queryByText('Không có dữ liệu phù hợp.')).not.toBeInTheDocument();
 vi.mocked(api.listParentGuide).mockResolvedValueOnce({total:0,limit:10,offset:0,rows:[]});fireEvent.click(screen.getAllByRole('button',{name:'Làm mới'}).at(-1)!);expect(await screen.findByText('Không có dữ liệu phù hợp.')).toBeVisible();
});

it('guides ignores an old query response after the latest search',async()=>{
 let finish!:(r:api.ParentGuideListResponse)=>void;vi.mocked(api.listParentGuide).mockReturnValueOnce(new Promise(done=>{finish=done;})).mockResolvedValueOnce({total:1,limit:10,offset:0,rows:[{...guideRows[0],disease_group:'LATEST-GUIDE'}]});
 render(<ParentGuideManager />);fireEvent.click(screen.getByRole('button',{name:'Xem dữ liệu đã import'}));
 fireEvent.change(screen.getByPlaceholderText(/^Tìm tên nhóm bệnh/),{target:{value:'latest'}});await screen.findByText('LATEST-GUIDE');
 await act(async()=>finish({total:1,limit:10,offset:0,rows:[{...guideRows[0],disease_group:'STALE-GUIDE'}]}));expect(screen.queryByText('STALE-GUIDE')).not.toBeInTheDocument();expect(screen.getByText('LATEST-GUIDE')).toBeVisible();
});

it('disease search with no matches keeps real totals and a focusable table without a false success',async()=>{
 await openCodes();fireEvent.change(screen.getByLabelText('Tìm mã hoặc tên'),{target:{value:'NO-FIXTURE-MATCH'}});
 await screen.findByText('Không có dữ liệu phù hợp.');expect(screen.getByText('Hiển thị 0–0 / 0')).toBeVisible();
 expect(screen.getByRole('region',{name:'Bảng mã bệnh'})).toHaveAttribute('tabindex','0');expect(screen.getByRole('button',{name:'Trang sau'})).toBeDisabled();
});
it('disease null metadata never claims zero missing codes after a failed read',async()=>{
 vi.mocked(api.getDiseaseCodesStatus).mockRejectedValue(new api.ApiError(500,'Metadata error fixture'));
 render(<DiseaseCodesManager />);fireEvent.click(screen.getByRole('button',{name:/Mở danh sách mã bệnh/}));await screen.findByText('Metadata error fixture');
 expect(screen.queryByText(/^Không phát hiện mã bệnh/)).not.toBeInTheDocument();expect(screen.queryByText(/Hiển thị/)).not.toBeInTheDocument();
});
it('regions preserves true zero metadata separately from a failed status read',async()=>{
 vi.mocked(api.getProvinceRegionsStatus).mockRejectedValueOnce(new api.ApiError(500,'Region status fixture')).mockResolvedValueOnce({has_province_regions:false,total_rows:0,uploaded_file:null});
 render(<ProvinceRegionsManager />);await screen.findByText('Region status fixture');expect(screen.getByText('Chưa xác định')).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Làm mới'}));await screen.findByText('Chưa import');expect(screen.getByText('0')).toBeVisible();expect(api.importProvinceRegions).not.toHaveBeenCalled();
});
it('regions disables choosing a new file while a preview is pending',async()=>{
 let finish!:(r:api.ProvinceRegionsPreview)=>void;vi.mocked(api.previewProvinceRegions).mockReturnValueOnce(new Promise(done=>{finish=done;}));
 const view=render(<ProvinceRegionsManager />);selectFile(view.container,file());expect(screen.getByRole('button',{name:'Chọn file kiểm tra'})).toBeDisabled();
 await act(async()=>finish(preview));expect(screen.getByRole('button',{name:'Chọn file kiểm tra'})).toBeEnabled();expect(api.importProvinceRegions).not.toHaveBeenCalled();
});
it('guides blocks a missing-column preview and preserves file-provider rejection',async()=>{
 vi.mocked(api.previewParentGuide).mockResolvedValueOnce({...preview,duplicate_groups_removed:0,missing_columns:['TENNHOMICD']});
 const view=render(<ParentGuideManager />);selectFile(view.container,file());await screen.findByText('File thiếu cột: TENNHOMICD');expect(screen.getByRole('button',{name:'Import file này'})).toBeDisabled();expect(api.importParentGuide).not.toHaveBeenCalled();
 vi.mocked(api.previewParentGuide).mockRejectedValueOnce(new api.ApiError(400,'Guide invalid file fixture'));selectFile(view.container,file('invalid.txt',''));await screen.findByText('Guide invalid file fixture');expect(screen.queryByRole('button',{name:'Import file này'})).not.toBeInTheDocument();
});
it('guides keeps server pagination and no-results search without changing stored content',async()=>{
 vi.mocked(api.listParentGuide).mockResolvedValue({total:11,limit:10,offset:0,rows:guideRows});
 render(<ParentGuideManager />);fireEvent.click(screen.getByRole('button',{name:'Xem dữ liệu đã import'}));await screen.findByText('Nhóm hướng dẫn kiểm thử');
 fireEvent.click(screen.getByRole('button',{name:'Trang sau'}));await waitFor(()=>expect(api.listParentGuide).toHaveBeenLastCalledWith({search:undefined,limit:10,offset:10}));
 vi.mocked(api.listParentGuide).mockResolvedValue({total:0,limit:10,offset:0,rows:[]});fireEvent.change(screen.getByLabelText('Tìm trong hướng dẫn'),{target:{value:'NO-MATCH'}});
 await waitFor(()=>expect(api.listParentGuide).toHaveBeenLastCalledWith({search:'NO-MATCH',limit:10,offset:0}));await screen.findByText('Không có dữ liệu phù hợp.');expect(api.importParentGuide).not.toHaveBeenCalled();
});
