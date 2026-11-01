import { Loader2 } from 'lucide-react';
import { count, Facts } from './ManagementParts';
import type { DiseaseCodesManagerState } from './useCatalogManagers';

export default function DiseaseCodesWorkspace({s}:{s:DiseaseCodesManagerState}) {
  if(!s.expanded)return <section className="dm-panel dm-codes-collapsed"><h3>Kiểm tra danh sách mã bệnh DS-MaBenh</h3><p className="dm-format-note">Tra cứu MAICD, tên bệnh và thông tin nhóm trước khi nhập DS-BenhNhan.</p><button type="button" onClick={()=>s.setExpanded(true)} aria-expanded={false}>Mở danh sách mã bệnh</button></section>;
  return <section className="dm-panel dm-codes-workspace" aria-label="Tra cứu danh mục mã bệnh">
    <header className="dm-panel-header"><div><h3>Danh sách mã bệnh đã import</h3><p>Kiểm tra DS-MaBenh theo mã, tên bệnh và thông tin nhóm; không sửa danh mục tại bảng tra cứu.</p></div>
      <div className="dm-actions"><button type="button" onClick={s.load} disabled={s.loading}>{s.loading&&<Loader2 size={15} className="animate-spin" />}Làm mới mã bệnh</button><button type="button" onClick={()=>s.setExpanded(false)} aria-expanded={true}>Thu gọn</button></div>
    </header>
    <Facts items={[["Tổng mã bệnh",count(s.status?.total_codes)],["Số nhóm bệnh",count(s.status?.distinct_groups)],["Mã thiếu nhóm",count(s.data?.missing_group_total)]]} />
    <p className="dm-source-file">File đang dùng: {s.status?.uploaded_file??'Chưa có thông tin'}</p>
    <div className="dm-filter-bar">
      <label className="dm-search"><span>Tìm mã hoặc tên</span><input value={s.search} onChange={(e)=>s.setSearch(e.target.value)} placeholder="Tìm MAICD, tên bệnh, IDNHOMICD, MANHOMBAOCAO, tên nhóm bệnh..." /></label>
      <label className="dm-checkbox"><input type="checkbox" checked={s.onlyMissing} onChange={(e)=>{s.setOnlyMissing(e.target.checked);s.setPage(1);}} />Chỉ xem mã thiếu nhóm bệnh</label>
      <label><span>Số dòng mỗi trang</span><select value={s.pageSize} onChange={(e)=>{s.setPageSize(Number(e.target.value));s.setPage(1);}}>{[10,25,50,100].map(n=><option key={n} value={n}>{n} dòng</option>)}</select></label>
    </div>
    {s.error&&<p role="alert" className="dm-feedback" data-kind="error">{s.error}</p>}
    {s.error&&s.data&&<p className="dm-format-note">Danh sách đã có được giữ lại; truy vấn mới chưa tải thành công.</p>}
    {!s.error&&s.status&&!s.status.has_disease_codes&&<p className="dm-format-note">Chưa có DS-MaBenh. Hãy import file DS-MaBenh trước, sau đó mới import DS-BenhNhan để phân tích.</p>}
    {!s.error&&!s.loading&&s.data?.missing_group_total===0&&s.status?.has_disease_codes&&<p className="dm-feedback">Không phát hiện mã bệnh nào trong DS-MaBenh bị thiếu thông tin nhóm bệnh.</p>}
    <div className="dm-table-scroll" role="region" aria-label="Bảng mã bệnh" tabIndex={0}><table>
      <thead><tr>{['MAICD','Tên bệnh','IDNHOMICD','MANHOMBAOCAO','Tên nhóm bệnh','Trạng thái'].map(h=><th scope="col" key={h}>{h}</th>)}</tr></thead>
      <tbody>{s.loading?<tr><td colSpan={6}>Đang tải...</td></tr>:s.data?.rows.length?s.data.rows.map(row=><tr key={row.id}>
        <th scope="row">{row.icd_code}</th><td>{row.disease_name??'—'}</td><td>{row.group_id??'—'}</td><td>{row.report_group_code??'—'}</td><td>{row.group_name??'—'}</td><td><span className="dm-badge">{row.missing_group?'Thiếu nhóm':'OK'}</span></td>
      </tr>):<tr><td colSpan={6}>{s.error&&!s.data?'Chưa tải được danh sách.':'Không có dữ liệu phù hợp.'}</td></tr>}</tbody>
    </table></div>
    {s.data&&<footer className="dm-pagination"><span>Hiển thị {s.data.total===0?0:(s.page-1)*s.pageSize+1}–{Math.min(s.page*s.pageSize,s.data.total)} / {s.data.total}</span><div>
      <button type="button" aria-label="Trang đầu" disabled={s.page<=1} onClick={()=>s.setPage(1)}>«</button><button type="button" aria-label="Trang trước" disabled={s.page<=1} onClick={()=>s.setPage(p=>Math.max(1,p-1))}>‹</button>
      <span>Trang {s.page} / {s.totalPages}</span><button type="button" aria-label="Trang sau" disabled={s.page>=s.totalPages} onClick={()=>s.setPage(p=>Math.min(s.totalPages,p+1))}>›</button><button type="button" aria-label="Trang cuối" disabled={s.page>=s.totalPages} onClick={()=>s.setPage(s.totalPages)}>»</button>
    </div></footer>}
  </section>;
}
