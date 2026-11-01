import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export function count(value:unknown) { return typeof value==='number'&&Number.isFinite(value)?value.toLocaleString('vi-VN'):'—'; }
export function Feedback({message}:{message:{type:'success'|'error';text:string}|null}) {
  return message?<p role={message.type==='error'?'alert':'status'} className="dm-feedback" data-kind={message.type}>{message.text}</p>:null;
}
export function Facts({items}:{items:Array<[string,ReactNode]>}) {
  return <dl className="dm-facts">{items.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}
export function SampleRows({rows}:{rows:Array<Record<string,string>>}) {
  const columns=rows[0]?Object.keys(rows[0]):[];
  return rows.length===0?<p className="dm-empty">Không có dữ liệu để hiển thị.</p>:<div className="dm-table-scroll" role="region" aria-label="Mẫu dữ liệu trong file" tabIndex={0}>
    <table><thead><tr>{columns.map((col)=><th scope="col" key={col}>{col}</th>)}</tr></thead><tbody>{rows.map((r,i)=><tr key={i}>{columns.map((col)=><td key={col}>{r[col]}</td>)}</tr>)}</tbody></table>
  </div>;
}
interface PreviewShape {sheet:string;total_rows:number;valid_rows:number;invalid_rows:number;missing_columns:string[];sample_rows:Array<Record<string,string>>}
export function FileReview({preview,file,showRows,importing,onToggle,onCancel,onImport}:{preview:PreviewShape;file:File|null;showRows:boolean;importing:boolean;onToggle:()=>void;onCancel:()=>void;onImport:()=>void}) {
  return <section className="dm-file-review" aria-label="Kết quả kiểm tra file">
    <header><div><h4>Kết quả kiểm tra file</h4><p>{file?.name} · Sheet {preview.sheet}</p></div><div className="dm-actions">
      <button type="button" onClick={onToggle}>{showRows?'Ẩn mẫu dữ liệu':'Xem mẫu dữ liệu'}</button>
      <button type="button" onClick={onCancel}>Hủy</button>
      <button type="button" onClick={onImport} disabled={!file||preview.missing_columns.length>0||importing} className="dm-primary">{importing&&<Loader2 size={15} className="animate-spin" />}Import file này</button>
    </div></header>
    <Facts items={[["Tổng dòng",count(preview.total_rows)],["Dòng hợp lệ",count(preview.valid_rows)],["Dòng bỏ qua",count(preview.invalid_rows)]]} />
    {preview.missing_columns.length>0&&<p role="alert" className="dm-feedback" data-kind="error">File thiếu cột bắt buộc: {preview.missing_columns.join(', ')}</p>}
    {showRows&&<SampleRows rows={preview.sample_rows} />}
  </section>;
}
