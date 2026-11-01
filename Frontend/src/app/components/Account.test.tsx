import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/lib/i18n';
import * as api from '@/lib/api';
import viStrings from '@/i18n/locales/vi';
import Account from './Account';

const auth=vi.hoisted(()=>({user:{id:1,username:'isolated_account',full_name:'Tài khoản kiểm thử',role:'staff',is_active:true,permissions:[],birth_date:null,gender:null,position:null} as api.CurrentUser|null,logout:vi.fn(),refreshUser:vi.fn()}));
vi.mock('../contexts/AuthContext',()=>({useAuth:()=>auth}));
vi.mock('@/lib/api',async(original)=>({...await original<typeof import('@/lib/api')>(),getToken:vi.fn(()=>null),listSessions:vi.fn(),changePassword:vi.fn(),updateProfile:vi.fn(),revokeSession:vi.fn(),revokeOtherSessions:vi.fn()}));
const sessions:api.LoginSessionInfo[]=[
 {id:1,ip_address:'192.0.2.1',user_agent:'Chrome/1.0',created_at:'2026-10-01T00:00:00Z',last_seen_at:'2026-10-02T00:00:00Z',is_current:true,revoked_at:null},
 {id:2,ip_address:null,user_agent:'Firefox/1.0',created_at:'2026-10-01T00:00:00Z',last_seen_at:'2026-10-02T00:00:00Z',is_current:false,revoked_at:null},
 {id:3,ip_address:null,user_agent:'Edg/1.0',created_at:'2026-10-01T00:00:00Z',last_seen_at:'2026-10-02T00:00:00Z',is_current:false,revoked_at:'2026-10-03T00:00:00Z'},
];
beforeEach(()=>{
 vi.resetAllMocks();localStorage.clear();auth.user={id:1,username:'isolated_account',full_name:'Tài khoản kiểm thử',role:'staff',is_active:true,permissions:[]};
 vi.mocked(api.getToken).mockReturnValue(null);vi.mocked(api.listSessions).mockResolvedValue(sessions);
 vi.mocked(api.updateProfile).mockResolvedValue(auth.user);vi.mocked(api.changePassword).mockResolvedValue({message:'ok'});
 vi.mocked(api.revokeSession).mockResolvedValue({message:'ok'});vi.mocked(api.revokeOtherSessions).mockResolvedValue({revoked:1});auth.refreshUser.mockResolvedValue(undefined);
});
const mount=()=>render(<I18nProvider><Account /></I18nProvider>);
async function loaded(){mount();await screen.findByText('Chrome');}
const secret=()=>`runtimeSecret_${Math.random().toString(36).slice(2)}_${Date.now()}`;
function fillPasswords(current:string,next:string,confirm=next){
 fireEvent.change(screen.getByLabelText(/^Mật khẩu hiện tại/),{target:{value:current}});
 fireEvent.change(screen.getByLabelText(/^Mật khẩu mới/),{target:{value:next}});
 fireEvent.change(screen.getByLabelText(/^Nhập lại mật khẩu mới/),{target:{value:confirm}});
}
const submit=()=>screen.getByRole('button',{name:'Đổi mật khẩu'});

it('keeps no-session state and does not load sessions without an authenticated user',()=>{
 auth.user=null;mount();expect(screen.getByText(viStrings['account.noSession'])).toBeVisible();expect(api.listSessions).not.toHaveBeenCalled();
});

it.each(['staff','admin'])('keeps self-service profile payload and auth refresh for %s without sending role changes',async(role)=>{
 auth.user!.role=role;await loaded();fireEvent.change(screen.getByLabelText('Họ và tên'),{target:{value:'Tên hồ sơ kiểm thử'}});
 fireEvent.change(screen.getByLabelText('Ngày sinh'),{target:{value:'2000-01-01'}});
 fireEvent.change(screen.getByLabelText('Giới tính'),{target:{value:'Khác'}});fireEvent.change(screen.getByLabelText('Chức vụ'),{target:{value:'Nhân viên'}});
 fireEvent.click(screen.getByRole('button',{name:'Lưu thông tin'}));expect(await screen.findByText('Đã cập nhật thông tin cá nhân.')).toBeVisible();
 expect(api.updateProfile).toHaveBeenCalledTimes(1);expect(auth.refreshUser).toHaveBeenCalledTimes(1);
 const payload=vi.mocked(api.updateProfile).mock.calls[0][0];expect(Object.keys(payload).sort()).toEqual(['birth_date','full_name','gender','position']);
 expect(payload.full_name==='Tên hồ sơ kiểm thử'&&payload.birth_date==='2000-01-01').toBe(true);
});

it('keeps profile API failure visible without claiming success or changing auth state',async()=>{
 vi.mocked(api.updateProfile).mockRejectedValueOnce(new api.ApiError(500,'Profile isolated error'));
 await loaded();fireEvent.click(screen.getByRole('button',{name:'Lưu thông tin'}));expect(await screen.findByText('Profile isolated error')).toBeVisible();
 expect(screen.queryByText('Đã cập nhật thông tin cá nhân.')).not.toBeInTheDocument();expect(auth.refreshUser).not.toHaveBeenCalled();
});

it('keeps required, minimum-length and confirmation validation without calling password API',async()=>{
 await loaded();fireEvent.click(submit());expect(await screen.findByText(viStrings['account.security.changePwd.required'])).toBeVisible();
 fillPasswords(secret(),'x');fireEvent.click(submit());expect(await screen.findByText(viStrings['account.security.changePwd.tooShort'])).toBeVisible();
 fillPasswords(secret(),secret(),secret());fireEvent.click(submit());expect(await screen.findByText(viStrings['account.security.changePwd.mismatch'])).toBeVisible();
 expect(api.changePassword).not.toHaveBeenCalled();
});

it('keeps password payload handling, pending state and field clearing after success without logging credentials',async()=>{
 let finish!:(value:{message:string})=>void;vi.mocked(api.changePassword).mockReturnValueOnce(new Promise((done)=>{finish=done;}));
 await loaded();const current=secret(),next=secret();fillPasswords(current,next);fireEvent.click(submit());expect(submit()).toBeDisabled();
 const args=vi.mocked(api.changePassword).mock.calls[0];expect(args[0]===current&&args[1]===next).toBe(true);
 await act(async()=>finish({message:'ok'}));expect(await screen.findByText(viStrings['account.security.changePwd.success'])).toBeVisible();
 expect((screen.getByLabelText(/^Mật khẩu hiện tại/) as HTMLInputElement).value==='').toBe(true);
 expect((screen.getByLabelText(/^Mật khẩu mới/) as HTMLInputElement).value==='').toBe(true);
});

it('keeps incorrect-password errors and allows retry without clearing entered fields prematurely',async()=>{
 vi.mocked(api.changePassword).mockRejectedValueOnce(new api.ApiError(401,'Password rejected fixture'));
 await loaded();const current=secret(),next=secret();fillPasswords(current,next);fireEvent.click(submit());
 expect(await screen.findByText('Password rejected fixture')).toBeVisible();expect(screen.queryByText(viStrings['account.security.changePwd.success'])).not.toBeInTheDocument();
 expect((screen.getByLabelText(/^Mật khẩu hiện tại/) as HTMLInputElement).value===current).toBe(true);fireEvent.click(submit());
 expect(await screen.findByText(viStrings['account.security.changePwd.success'])).toBeVisible();
});

it('keeps session refresh/revoke/revoke-others calls and hides revoke action for the current or revoked session',async()=>{
 await loaded();expect(screen.getAllByRole('button',{name:'Thu hồi'})).toHaveLength(1);
 fireEvent.click(screen.getByRole('button',{name:'Thu hồi'}));await waitFor(()=>expect(api.revokeSession).toHaveBeenCalledWith(2));
 await waitFor(()=>expect(api.listSessions).toHaveBeenCalledTimes(2));
 fireEvent.click(screen.getByRole('button',{name:viStrings['account.sessions.revokeOthers']}));await waitFor(()=>expect(api.revokeOtherSessions).toHaveBeenCalledTimes(1));
 await waitFor(()=>expect(api.listSessions).toHaveBeenCalledTimes(3));
});

it('keeps session 401/403 errors, refresh retry, and revoke failures visible',async()=>{
 vi.mocked(api.listSessions).mockRejectedValueOnce(new api.ApiError(401,'Session expired fixture'));mount();
 expect(await screen.findByText('Session expired fixture')).toBeVisible();fireEvent.click(screen.getByRole('button',{name:viStrings['common.refresh']}));
 await screen.findByText('Chrome');vi.mocked(api.revokeSession).mockRejectedValueOnce(new api.ApiError(403,'Revoke forbidden fixture'));
 fireEvent.click(screen.getByRole('button',{name:'Thu hồi'}));expect(await screen.findByText('Revoke forbidden fixture')).toBeVisible();
 vi.mocked(api.revokeOtherSessions).mockRejectedValueOnce(new api.ApiError(500,'Revoke unavailable fixture'));
 fireEvent.click(screen.getByRole('button',{name:viStrings['account.sessions.revokeOthers']}));expect(await screen.findByText('Revoke unavailable fixture')).toBeVisible();
});

it('preserves logout confirmation and delegates only to the existing auth context',async()=>{
 await loaded();const confirm=vi.spyOn(window,'confirm').mockReturnValue(false);fireEvent.click(screen.getByRole('button',{name:viStrings['user.logout']}));expect(auth.logout).not.toHaveBeenCalled();
 confirm.mockReturnValue(true);fireEvent.click(screen.getByRole('button',{name:viStrings['user.logout']}));expect(auth.logout).toHaveBeenCalledTimes(1);confirm.mockRestore();
});

it('keeps technical token information closed by default and disables copying when no token exists',async()=>{
 await loaded();const summary=screen.getByText(viStrings['account.session.title']);const detail=summary.closest('details')!;expect(detail.open).toBe(false);
 fireEvent.click(summary);expect(detail.open).toBe(true);expect(screen.getByRole('button',{name:viStrings['account.session.copy']})).toBeDisabled();
 expect(api.getToken).toHaveBeenCalledTimes(1);
});

it('exposes labelled native forms and keyboard focus without changing profile submission',async()=>{
 await loaded();const field=screen.getByLabelText('Họ và tên');field.focus();expect(field).toHaveFocus();
 const form=field.closest('form')!;expect(form).toHaveAttribute('novalidate');fireEvent.submit(form);
 await waitFor(()=>expect(api.updateProfile).toHaveBeenCalledTimes(1));
 const password=screen.getByLabelText(/^Mật khẩu hiện tại/);expect(password).toHaveAttribute('type','password');expect(password.closest('form')).not.toBe(form);
});

it('shows synchronous logout failure without modifying auth policy and allows a confirmed retry',async()=>{
 auth.logout.mockImplementationOnce(()=>{throw new Error('Local logout failure');});await loaded();const confirm=vi.spyOn(window,'confirm').mockReturnValue(true);
 fireEvent.click(screen.getByRole('button',{name:viStrings['user.logout']}));expect(await screen.findByRole('alert')).toHaveTextContent('Không thể đăng xuất. Vui lòng thử lại.');
 fireEvent.click(screen.getByRole('button',{name:viStrings['user.logout']}));expect(auth.logout).toHaveBeenCalledTimes(2);expect(screen.queryByRole('alert')).not.toBeInTheDocument();confirm.mockRestore();
});
