import AdminDetails from './admin/AdminDetails';
import AdminPageHeading from './admin/AdminPageHeading';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Database } from 'lucide-react';
import {
  getActiveImportJob,
  runImportJob,
  subscribeImportJob,
  syncImportJobStatus,
  type ActiveImportJob,
  type ImportKind,
} from '@/lib/importJobs';
import * as api from '@/lib/api';
import DiseaseCodesManager from './DiseaseCodesManager';
import ParentGuideManager from './ParentGuideManager';
import ProvinceRegionsManager from './ProvinceRegionsManager';

import ImportWorkspace from './data-management/ImportWorkspace';
import './data-management/data-management.css';
interface Toast {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

export default function DataImport() {
  const patientFileRef = useRef<HTMLInputElement>(null);
  const diseaseCodesFileRef = useRef<HTMLInputElement>(null);
  const [activeImport, setActiveImport] = useState<ActiveImportJob | null>(() => getActiveImportJob());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [patientStatus, setPatientStatus] = useState<api.PatientDataStatus | null>(null);
  const [diseaseCodesStatus, setDiseaseCodesStatus] = useState<api.DiseaseCodesStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);

  const loadImportStatuses = useCallback(async () => {
    setStatusLoading(true);
    setStatusError(null);
    try {
      const [patient, diseaseCodes] = await Promise.all([
        api.getPatientDataStatus(),
        api.getDiseaseCodesStatus(),
      ]);
      setPatientStatus(patient);
      setDiseaseCodesStatus(diseaseCodes);
    } catch (error) {
      console.error('Không tải được trạng thái import', error);
      setStatusError(error instanceof Error ? error.message : String(error));
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeImportJob(() => setActiveImport(getActiveImportJob()));
    void syncImportJobStatus().then(() => setJobError(null)).catch((e) => setJobError(e instanceof Error ? e.message : String(e)));
    void loadImportStatuses();
    const intervalId = window.setInterval(() => {
      void syncImportJobStatus().then(() => setJobError(null)).catch((e) => setJobError(e instanceof Error ? e.message : String(e)));
    }, 3000);

    return () => {
      unsubscribe();
      window.clearInterval(intervalId);
    };
  }, [loadImportStatuses]);

  const pushToast = (type: Toast['type'], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 4000);
  };

  const handleImport = async (kind: ImportKind, file: File) => {
    const label = kind === 'patient' ? 'DS-BenhNhan' : 'DS-MaBenh';
    try {
      await runImportJob(kind, file);
      await loadImportStatuses();
      pushToast('success', `Import ${label} thành công: ${file.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      pushToast('error', message);
    }
  };

  const importing = activeImport !== null;

  return <div className="admin-page-stack admin-dataimport-content data-management-scope">
<AdminPageHeading keepDescription icon={Database} title="Import dữ liệu" description={<>Tập trung các thao tác nạp dữ liệu: danh sách bệnh nhân, mã bệnh, phân miền khu vực và hướng dẫn phụ huynh. Hãy kiểm tra đúng file trước khi import để tránh ghi đè dữ liệu hiện tại.</>} />
{toasts.map(toast=><div key={toast.id} role={toast.type==='error'?'alert':'status'} className="dm-feedback" data-kind={toast.type}><span>{toast.message}</span><button type="button" aria-label="Đóng thông báo" onClick={()=>setToasts(prev=>prev.filter(item=>item.id!==toast.id))}>×</button></div>)}
{statusError&&<div className="dm-feedback" data-kind="error"><p role="alert">{statusError}</p><button type="button" onClick={loadImportStatuses} disabled={statusLoading}>Tải lại trạng thái</button></div>}
{jobError&&<p role="alert" className="dm-feedback" data-kind="error">{jobError}</p>}
<ImportWorkspace patientRef={patientFileRef} codesRef={diseaseCodesFileRef} active={activeImport} patient={patientStatus} codes={diseaseCodesStatus} loading={statusLoading} onImport={handleImport} />
<AdminDetails title="Tra cứu mã bệnh đã nhập (DS-MaBenh)"><DiseaseCodesManager /></AdminDetails><ProvinceRegionsManager /><ParentGuideManager />
</div>;
}
