import { Loader2, RefreshCcw, Upload } from 'lucide-react';
import { count, Facts, Feedback, FileReview } from './ManagementParts';
import type { ProvinceRegionsManagerState } from './useCatalogManagers';

export default function RegionsWorkspace({s}:{s:ProvinceRegionsManagerState}) {
  return <section className="dm-panel dm-regions-workspace" aria-labelledby="dm-regions-title">
    <header className="dm-panel-header"><div><h3 id="dm-regions-title">Phân miền tỉnh/thành</h3><p>Import file Excel chứa tỉnh/thành phố và cột miền để mục Khu vực lọc theo Miền Bắc, Miền Trung, Miền Nam.</p></div></header>
    <div className="dm-regions-config">
      <div className="dm-region-status"><Facts items={[["Trạng thái",s.status?s.status.has_province_regions?'Đã import':'Chưa import':'Chưa xác định'],["Số tỉnh/thành",count(s.status?.total_rows)],["File đang lưu",s.status?.uploaded_file??'Chưa có thông tin']]} /></div>
      <div className="dm-file-tools"><h4>Kiểm tra file trước khi lưu</h4><div className="dm-actions">
        <button type="button" onClick={()=>s.fileRef.current?.click()} disabled={s.loading||s.importing}>{s.loading?<Loader2 size={15} className="animate-spin" />:<Upload size={15} />}Chọn file kiểm tra</button>
        <button type="button" onClick={s.loadStatus} disabled={s.loading||s.importing}><RefreshCcw size={15} />Làm mới</button>
      </div><p className="dm-format-note">File cần có cột <code>province_code</code>, <code>province_name</code>, <code>mien_code</code>, <code>mien</code>. Cột <code>aliases</code> là tùy chọn.</p></div>
    </div>
    <input ref={s.fileRef} type="file" accept=".xlsx" hidden aria-label="File phân miền tỉnh/thành" onChange={(e)=>{const f=e.target.files?.[0];e.target.value='';if(f)void s.handlePreview(f);}} />
    <Feedback message={s.message} />
    {s.preview&&<FileReview preview={s.preview} file={s.selectedFile} showRows={s.showPreviewRows} importing={s.importing}
      onToggle={()=>s.setShowPreviewRows(v=>!v)} onCancel={()=>{s.setPreview(null);s.setSelectedFile(null);}} onImport={s.handleImport} />}
  </section>;
}
