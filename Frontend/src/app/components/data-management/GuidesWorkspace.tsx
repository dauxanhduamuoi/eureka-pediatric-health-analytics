import { Loader2, RefreshCcw, Upload } from 'lucide-react';
import { count, Facts, Feedback, FileReview } from './ManagementParts';
import type { ParentGuideManagerState } from './useCatalogManagers';

export default function GuidesWorkspace({s}:{s:ParentGuideManagerState}) {
  const rows=(s.importedData?.rows??[]).map(row=>({TENNHOMICD:row.disease_group,TRIEUCHUNGTHUONGGAP:row.symptoms??'',DAUHIEUCANDIKHAM:row.warning_signs??'',CACHPHONGBENH:row.prevention??''}));
  return <section className="dm-panel dm-guides-workspace" aria-labelledby="dm-guides-title">
    <header className="dm-panel-header"><div><h3 id="dm-guides-title">Hướng dẫn phụ huynh</h3><p>Import triệu chứng thông thường, triệu chứng nguy hiểm cần đi khám và cách phòng bệnh cho trang phụ huynh.</p></div>
      <div className="dm-actions"><button type="button" onClick={()=>s.fileRef.current?.click()} disabled={s.loading||s.importing}>{s.loading?<Loader2 size={15} className="animate-spin" />:<Upload size={15} />}Chọn file kiểm tra</button>
        <button type="button" onClick={s.loadStatus} disabled={s.loading||s.importing}><RefreshCcw size={15} />Làm mới</button>
      </div>
    </header>
    <Facts items={[["Trạng thái",s.status?s.status.has_parent_guide?'Đã có dữ liệu':'Chưa có dữ liệu':'Chưa xác định'],["Số nhóm bệnh",count(s.status?.total_rows)],["File đang lưu",s.status?.uploaded_file??'Chưa có thông tin']]} />
    <input ref={s.fileRef} type="file" accept=".xlsx" hidden aria-label="File hướng dẫn phụ huynh" onChange={(e)=>{const f=e.target.files?.[0];e.target.value='';if(f)void s.handlePreview(f);}} />
    <Feedback message={s.message} />
    {s.preview&&<FileReview preview={s.preview} file={s.selectedFile} showRows={s.showPreviewRows} importing={s.importing}
      onToggle={()=>s.setShowPreviewRows(v=>!v)} onCancel={()=>{s.setPreview(null);s.setSelectedFile(null);}} onImport={s.handleImport} />}
    <div className="dm-guide-reading-heading"><div><h4>Nội dung đã nhập</h4><p>Tra cứu và đọc đầy đủ nội dung theo nhóm bệnh.</p></div>
      <button type="button" onClick={s.toggleImportedRows} aria-expanded={s.showImportedRows}>{s.showImportedRows?'Ẩn dữ liệu đã import':'Xem dữ liệu đã import'}</button>
    </div>
    {s.showImportedRows&&<div className="dm-guide-reading">
      <div className="dm-filter-bar"><label className="dm-search"><span>Tìm trong hướng dẫn</span><input value={s.importedSearch} onChange={(e)=>s.setImportedSearch(e.target.value)} placeholder="Tìm tên nhóm bệnh, triệu chứng, dấu hiệu cần đi khám, cách phòng bệnh..." /></label>
        <label><span>Số dòng mỗi trang</span><select value={s.importedPageSize} onChange={(e)=>{s.setImportedPageSize(Number(e.target.value));s.setImportedPage(1);}}>{[10,25,50,100].map(n=><option key={n} value={n}>{n} dòng/trang</option>)}</select></label>
        <button type="button" onClick={s.loadImportedRows} disabled={s.loading}>Làm mới</button>
      </div>
      {s.loading?<p role="status" className="dm-empty">Đang tải...</p>:rows.length===0?<p className="dm-empty">{s.importedData?'Không có dữ liệu phù hợp.':'Chưa có dữ liệu để hiển thị.'}</p>:<div className="dm-guide-cards">
        {rows.map((r,i)=><article key={i} className="dm-guide-card"><h4>{r.TENNHOMICD}</h4><dl>
          <div><dt>Triệu chứng thường gặp</dt><dd>{r.TRIEUCHUNGTHUONGGAP}</dd></div>
          <div><dt>Dấu hiệu cần đi khám</dt><dd>{r.DAUHIEUCANDIKHAM}</dd></div>
          <div><dt>Cách phòng bệnh</dt><dd>{r.CACHPHONGBENH}</dd></div>
        </dl></article>)}
      </div>}
      {s.importedData&&<footer className="dm-pagination"><span>Hiển thị {s.importedStart}-{s.importedEnd} / {count(s.importedData.total)}</span><div>
        <button type="button" aria-label="Trang đầu" disabled={s.importedPage<=1} onClick={()=>s.setImportedPage(1)}>«</button><button type="button" aria-label="Trang trước" disabled={s.importedPage<=1} onClick={()=>s.setImportedPage(p=>Math.max(1,p-1))}>‹</button><span>Trang {s.importedPage} / {s.totalImportedPages}</span>
        <button type="button" aria-label="Trang sau" disabled={s.importedPage>=s.totalImportedPages} onClick={()=>s.setImportedPage(p=>Math.min(s.totalImportedPages,p+1))}>›</button><button type="button" aria-label="Trang cuối" disabled={s.importedPage>=s.totalImportedPages} onClick={()=>s.setImportedPage(s.totalImportedPages)}>»</button>
      </div></footer>}
    </div>}
  </section>;
}
