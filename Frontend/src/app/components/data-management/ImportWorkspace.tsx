import type { RefObject } from 'react';
import { Loader2, Upload } from 'lucide-react';
import type { PatientDataStatus, DiseaseCodesStatus } from '@/lib/api';
import type { ActiveImportJob, ImportKind } from '@/lib/importJobs';
import { count } from './ManagementParts';

interface Props {
  patientRef:RefObject<HTMLInputElement>;codesRef:RefObject<HTMLInputElement>;active:ActiveImportJob|null;
  patient:PatientDataStatus|null;codes:DiseaseCodesStatus|null;loading:boolean;onImport:(kind:ImportKind,file:File)=>void;
}
export default function ImportWorkspace(p:Props) {
  return <section className="dm-import-workspace" aria-label="Nhập danh mục và dữ liệu bệnh nhân">
    <div className="dm-import-order"><h3>Chọn nguồn dữ liệu cần nhập</h3><p>Nên nhập DS-MaBenh trước DS-BenhNhan để map ICD sang nhóm bệnh. Kiểm tra đúng file trước khi thực hiện.</p></div>
    <div className="dm-upload-sources">
      <Source title="Import DS-MaBenh" description="Bảng mã bệnh dùng để map ICD sang nhóm bệnh. Nên import trước DS-BenhNhan."
        status={p.codes===null?(p.loading?'Đang kiểm tra':'Chưa xác định'):p.codes.has_disease_codes?'Đã import':'Chưa import'}
        detail={p.codes?`${count(p.codes.total_codes)} mã bệnh`:undefined} file={p.codes?.uploaded_file}
        busy={p.active?.kind==='disease-codes'} disabled={p.active!==null} label="Chọn file DS-MaBenh" busyLabel="Đang import DS-MaBenh" onChoose={()=>p.codesRef.current?.click()} />
      <Source title="Import DS-BenhNhan" description="Danh sách bệnh nhân dùng cho dashboard, phân tích khu vực, độ tuổi, giới tính và dự báo."
        status={p.patient===null?(p.loading?'Đang kiểm tra':'Chưa xác định'):p.patient.has_patient_data?'Đã import':'Chưa import'}
        detail={p.patient?`${count(p.patient.patient_rows)} dòng bệnh nhân`:undefined} file={p.patient?.uploaded_file}
        busy={p.active?.kind==='patient'} disabled={p.active!==null} label="Chọn file DS-BenhNhan" busyLabel="Đang import DS-BenhNhan" onChoose={()=>p.patientRef.current?.click()} />
    </div>
    {p.active&&<div role="status" className="dm-active-job"><Loader2 size={17} className="animate-spin" /><div><strong>Đang import {p.active.label}</strong><p>File: {p.active.fileName}. Bạn có thể chuyển sang mục khác hoặc reload trang, tiến trình vẫn được theo dõi từ backend.</p></div></div>}
    <input ref={p.patientRef} aria-label="File DS-BenhNhan" type="file" accept=".xlsx" hidden onChange={(e)=>{const file=e.target.files?.[0];e.target.value='';if(file)void p.onImport('patient',file);}} />
    <input ref={p.codesRef} aria-label="File DS-MaBenh" type="file" accept=".xlsx" hidden onChange={(e)=>{const file=e.target.files?.[0];e.target.value='';if(file)void p.onImport('disease-codes',file);}} />
  </section>;
}
function Source(p:{title:string;description:string;status:string;detail?:string;file?:string|null;busy:boolean;disabled:boolean;label:string;busyLabel:string;onChoose:()=>void}) {
  return <article className="dm-upload-source"><div className="dm-upload-identity"><header><h4>{p.title}</h4><span className="dm-source-state">{p.status}</span></header><p>{p.description}</p></div>
    <dl><div><dt>Dữ liệu hiện có</dt><dd>{p.detail??'—'}</dd></div><div><dt>File đang dùng</dt><dd>{p.file??'Chưa có thông tin'}</dd></div></dl>
    <button type="button" onClick={p.onChoose} disabled={p.disabled} className="dm-primary">{p.busy?<Loader2 size={16} className="animate-spin" />:<Upload size={16} />}{p.busy?p.busyLabel:p.label}</button>
  </article>;
}
