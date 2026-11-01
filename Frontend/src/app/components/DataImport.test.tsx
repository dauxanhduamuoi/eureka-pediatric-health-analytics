import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import * as api from '@/lib/api';
import * as jobs from '@/lib/importJobs';
import DataImport from './DataImport';

const job=vi.hoisted(()=>({active:null as jobs.ActiveImportJob|null,listener:null as (()=>void)|null}));
vi.mock('@/lib/importJobs',()=>({getActiveImportJob:()=>job.active,subscribeImportJob:vi.fn((fn:()=>void)=>{job.listener=fn;return ()=>{job.listener=null;};}),syncImportJobStatus:vi.fn(),runImportJob:vi.fn()}));
vi.mock('@/lib/api',async(original)=>({...await original<typeof import('@/lib/api')>(),getPatientDataStatus:vi.fn(),getDiseaseCodesStatus:vi.fn()}));
vi.mock('./DiseaseCodesManager',()=>({default:()=> <div>Codes fixture manager</div>}));
vi.mock('./ProvinceRegionsManager',()=>({default:()=> <div>Regions fixture manager</div>}));
vi.mock('./ParentGuideManager',()=>({default:()=> <div>Guides fixture manager</div>}));
beforeEach(()=>{
 vi.resetAllMocks();localStorage.clear();job.active=null;job.listener=null;
 vi.mocked(jobs.syncImportJobStatus).mockResolvedValue(null);vi.mocked(jobs.runImportJob).mockResolvedValue(undefined);
 vi.mocked(api.getPatientDataStatus).mockResolvedValue({has_patient_data:false,patient_rows:0,monthly_rows:0,periods:0,uploaded_file:null,latest_import_file:null,latest_import_at:null});
 vi.mocked(api.getDiseaseCodesStatus).mockResolvedValue({has_disease_codes:false,total_codes:0,distinct_groups:0,uploaded_file:null});
});
const mount=()=>render(<DataImport />);
it('keeps file kinds and payload identity, XLSX accept, success and nested managers',async()=>{
 mount();await waitFor(()=>expect(api.getPatientDataStatus).toHaveBeenCalledTimes(1));
 const patient=screen.getByLabelText('File DS-BenhNhan');expect(patient).toHaveAttribute('accept','.xlsx');
 const f=new File(['synthetic fixture'],'fixture_patient.xlsx');fireEvent.change(patient,{target:{files:[f]}});
 expect(await screen.findByText('Import DS-BenhNhan thành công: fixture_patient.xlsx')).toBeVisible();expect(jobs.runImportJob).toHaveBeenCalledWith('patient',f);
 const codes=new File(['synthetic fixture'],'fixture_codes.xlsx');fireEvent.change(screen.getByLabelText('File DS-MaBenh'),{target:{files:[codes]}});
 expect(await screen.findByText('Import DS-MaBenh thành công: fixture_codes.xlsx')).toBeVisible();expect(jobs.runImportJob).toHaveBeenLastCalledWith('disease-codes',codes);
 expect(screen.getByText('Codes fixture manager')).not.toBeVisible();fireEvent.click(screen.getByText('Tra cứu mã bệnh đã nhập (DS-MaBenh)'));expect(screen.getByText('Codes fixture manager')).toBeVisible();
});
it('keeps invalid/empty-file errors from provider and permits retry without fake success',async()=>{
 vi.mocked(jobs.runImportJob).mockRejectedValueOnce(new Error('File validation fixture'));mount();
 const f=new File([],'invalid.txt');fireEvent.change(screen.getByLabelText('File DS-BenhNhan'),{target:{files:[f]}});
 expect(await screen.findByText('File validation fixture')).toBeVisible();expect(screen.queryByText('Import DS-BenhNhan thành công: invalid.txt')).not.toBeInTheDocument();
 expect(jobs.runImportJob).toHaveBeenCalledWith('patient',f);fireEvent.change(screen.getByLabelText('File DS-BenhNhan'),{target:{files:[f]}});
 expect(await screen.findByText('Import DS-BenhNhan thành công: invalid.txt')).toBeVisible();
});
it('keeps an active job tracked and blocks both upload buttons until the subscribed state clears',async()=>{
 job.active={kind:'patient',label:'DS-BenhNhan',fileName:'fixture_patient.xlsx',startedAt:'2026-10-31T00:00:00Z'};mount();
 expect(screen.getByRole('button',{name:'Đang import DS-BenhNhan'})).toBeDisabled();expect(screen.getByRole('button',{name:'Chọn file DS-MaBenh'})).toBeDisabled();
 await act(async()=>{job.active=null;job.listener?.();});expect(screen.getByRole('button',{name:'Chọn file DS-BenhNhan'})).toBeEnabled();
});
it('keeps a job conflict explicit and does not display an import success',async()=>{
 vi.mocked(jobs.runImportJob).mockRejectedValueOnce(new api.ApiError(409,'Job conflict fixture'));mount();const f=new File(['fixture'],'fixture.xlsx');
 fireEvent.change(screen.getByLabelText('File DS-MaBenh'),{target:{files:[f]}});expect(await screen.findByText('Job conflict fixture')).toBeVisible();
 expect(screen.queryByText('Import DS-MaBenh thành công: fixture.xlsx')).not.toBeInTheDocument();
});
it('shows unknown metadata rather than fake zero and can retry the read without an upload',async()=>{
 const log=vi.spyOn(console,'error').mockImplementation(()=>{});
 vi.mocked(api.getPatientDataStatus).mockRejectedValueOnce(new api.ApiError(500,'Metadata unavailable fixture'));
 try {
  mount();expect(await screen.findByText('Metadata unavailable fixture')).toBeVisible();expect(screen.getAllByText('Chưa xác định')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button',{name:'Tải lại trạng thái'}));await waitFor(()=>expect(screen.queryByText('Metadata unavailable fixture')).not.toBeInTheDocument());
  expect(jobs.runImportJob).not.toHaveBeenCalled();expect(api.getPatientDataStatus).toHaveBeenCalledTimes(2);
 } finally {log.mockRestore();}
});
it('reports a failed job-status sync without fabricating an import success',async()=>{
 vi.mocked(jobs.syncImportJobStatus).mockRejectedValueOnce(new api.ApiError(500,'Job status unavailable fixture'));
 mount();expect(await screen.findByText('Job status unavailable fixture')).toBeVisible();expect(jobs.runImportJob).not.toHaveBeenCalled();
 expect(screen.queryByText(/Import .* thành công:/)).not.toBeInTheDocument();
});
