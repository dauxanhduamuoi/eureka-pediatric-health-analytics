import { CheckCircle2, Copy, KeyRound, Loader2 } from 'lucide-react';

interface Props {
  t:(key:string)=>string; current:string; next:string; confirm:string;
  onCurrent:(v:string)=>void; onNext:(v:string)=>void; onConfirm:(v:string)=>void;
  saving:boolean; success:boolean; error:string|null; onSubmit:()=>void;
  tokenAvailable:boolean; tokenLabel:string; copied:boolean; onCopy:()=>void;
}
export default function AccountSecurity(p:Props) {
  return <section className="account-panel account-security-panel" aria-labelledby="account-security-title">
    <header><h3 id="account-security-title">{p.t('account.security.changePwd.title')}</h3><p>{p.t('account.security.changePwd.desc')}</p></header>
    <form noValidate onSubmit={(e)=>{e.preventDefault();p.onSubmit();}}>
      <div className="account-password-fields">
        <PasswordField label={p.t('account.security.changePwd.current')} value={p.current} onChange={p.onCurrent} />
        <PasswordField label={p.t('account.security.changePwd.new')} value={p.next} onChange={p.onNext} hint={p.t('account.security.changePwd.hint')} />
        <PasswordField label={p.t('account.security.changePwd.confirm')} value={p.confirm} onChange={p.onConfirm} />
      </div>
      <div className="account-form-actions"><button type="submit" disabled={p.saving} className="account-primary">{p.saving?<Loader2 size={15} className="animate-spin" />:<KeyRound size={15} />}{p.t('account.security.changePwd.submit')}</button></div>
      {p.success&&<p role="status" className="account-feedback account-success">{p.t('account.security.changePwd.success')}</p>}
      {p.error&&<p role="alert" className="account-feedback account-error">{p.error}</p>}
    </form>
    <details className="account-technical-session">
      <summary>{p.t('account.session.title')}</summary>
      <p>{p.t('account.session.desc')}</p><span className="account-technical-label">{p.t('account.session.accessToken')}</span>
      <code>{p.tokenLabel}</code>
      <button type="button" onClick={p.onCopy} disabled={!p.tokenAvailable}>{p.copied?<CheckCircle2 size={14} />:<Copy size={14} />}{p.copied?p.t('account.session.copied'):p.t('account.session.copy')}</button>
      <p>{p.t('account.session.warn')}</p>
    </details>
  </section>;
}
function PasswordField({label,value,onChange,hint}:{label:string;value:string;onChange:(v:string)=>void;hint?:string}) {
  return <label className="account-field"><span>{label}</span><input type="password" value={value} onChange={(e)=>onChange(e.target.value)} autoComplete="new-password" aria-label={label} />{hint&&<small>{hint}</small>}</label>;
}
