import type { CurrentUser } from '@/lib/api';
import { Loader2, LogOut, Save } from 'lucide-react';

type T=(key:string)=>string;
export function AccountIdentity({user,displayName,roleLabel,initials,t,onLogout}:{user:CurrentUser;displayName:string;roleLabel:string;initials:string;t:T;onLogout:()=>void}) {
  return <header className="account-identity">
    <div className="account-initials" aria-hidden="true">{initials}</div>
    <div className="account-identity-copy"><h2>{displayName}</h2><p>@{user.username} · ID #{user.id}</p>
      <div className="account-identity-labels"><span>{roleLabel}</span><span>{user.is_active?t('common.active'):t('common.inactive')}</span></div>
    </div>
    <button type="button" onClick={onLogout} className="account-logout"><LogOut size={16} />{t('user.logout')}</button>
  </header>;
}

interface Props {
  user:CurrentUser; t:T; roleLabel:string;
  fullName:string; birthDate:string; gender:string; position:string;
  onFullName:(v:string)=>void; onBirthDate:(v:string)=>void; onGender:(v:string)=>void; onPosition:(v:string)=>void;
  saving:boolean; message:string|null; onSave:()=>void;
}
export default function AccountProfile(p:Props) {
  return <section className="account-panel account-profile-panel" aria-labelledby="account-profile-title">
    <header><h3 id="account-profile-title">{p.t('account.profile.title')}</h3><p>Cập nhật thông tin cá nhân của tài khoản hiện tại.</p></header>
    <dl className="account-readonly-fields"><div><dt>{p.t('account.profile.username')}</dt><dd>{p.user.username}</dd></div><div><dt>{p.t('account.profile.role')}</dt><dd>{p.roleLabel}</dd></div><div><dt>{p.t('account.profile.status')}</dt><dd>{p.user.is_active?p.t('common.active'):p.t('common.inactive')}</dd></div><div><dt>{p.t('account.profile.id')}</dt><dd>#{p.user.id}</dd></div></dl>
    <form noValidate onSubmit={(e)=>{e.preventDefault();p.onSave();}}>
      <div className="account-profile-fields">
        <Field label="Họ và tên" value={p.fullName} onChange={p.onFullName} />
        <Field label="Ngày sinh" type="date" value={p.birthDate} onChange={p.onBirthDate} />
        <Field label="Giới tính" value={p.gender} onChange={p.onGender} placeholder="Nam, nữ, khác..." />
        <Field label="Chức vụ" value={p.position} onChange={p.onPosition} placeholder="Bác sĩ, điều dưỡng, y tá, nhân viên..." />
      </div>
      <div className="account-form-actions"><button type="submit" disabled={p.saving} className="account-primary">{p.saving?<Loader2 size={15} className="animate-spin" />:<Save size={15} />}Lưu thông tin</button></div>
      {p.message&&<p role="status" className="account-feedback">{p.message}</p>}
    </form>
  </section>;
}
function Field({label,value,onChange,type='text',placeholder}:{label:string;value:string;onChange:(v:string)=>void;type?:string;placeholder?:string}) {
  return <label className="account-field"><span>{label}</span><input type={type} value={value} onChange={(e)=>onChange(e.target.value)} placeholder={placeholder} /></label>;
}
