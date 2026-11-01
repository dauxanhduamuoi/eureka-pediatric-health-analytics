import { ShieldCheck, KeyRound, Loader2 } from 'lucide-react';
import { Input, PermissionChecklist } from './PermissionControls';
import type { UserAdministration } from './useUserAdministration';

export default function PermissionDialogs({ admin }: { admin: UserAdministration }) {
  const {
    users, usersError, setUsers, setSelectedUserId, resetUserId,
    setResetUserId, savingPermissions, resetPassword, setResetPassword, resetResult,
    setResetResult, canAdmin, visiblePermissionDefs, selectedUser, togglePermission,
    saveSelectedUserPermissions, handleResetPassword,
  } = admin;
  return <>
    {selectedUser() && (
      <div role="dialog" aria-modal="true" aria-labelledby="permission-dialog-title" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
        <div className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-xl bg-white p-5 shadow-2xl">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h4 id="permission-dialog-title" className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                <ShieldCheck size={18} /> Phân quyền cho {selectedUser()?.username}
              </h4>
              <p className="mt-1 text-xs text-slate-500">
                Admin luôn dùng được các mục chính. Các quyền quản trị chỉ kiểm soát thao tác nâng cao.
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedUserId(null);
                setResetPassword('');
                setResetResult(null);
              }}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              Đóng
            </button>
          </div>
      <div>
        {usersError && <p role="alert" className="mb-3 text-sm text-red-700">{usersError}</p>}
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h4 className="mb-3 flex items-center gap-2 font-medium text-slate-800">
            <ShieldCheck size={16} /> Bảng phân quyền
          </h4>
          <PermissionChecklist
            title="Quyền được sử dụng"
            permissions={visiblePermissionDefs(selectedUser()?.role ?? 'staff')}
            selected={selectedUser()?.permissions ?? []}
            onToggle={(code) => {
              const target = selectedUser();
              if (!target) return;
              setUsers((cur) =>
                cur.map((u) =>
                  u.id === target.id ? { ...u, permissions: togglePermission(u.permissions, code) } : u,
                ),
              );
            }}
          />
          <button
            onClick={saveSelectedUserPermissions}
            disabled={savingPermissions || !canAdmin('admin.assign_permissions')}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {savingPermissions ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
            Lưu phân quyền
          </button>
        </div>
      </div>
        </div>
      </div>
    )}

    {resetUserId && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
        <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h4 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
                <KeyRound size={18} /> Reset mật khẩu
              </h4>
              <p className="mt-1 text-xs text-slate-500">
                Tài khoản: {users.find((u) => u.id === resetUserId)?.username}
              </p>
            </div>
            <button
              onClick={() => {
                setResetUserId(null);
                setResetPassword('');
                setResetResult(null);
              }}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
            >
              Đóng
            </button>
          </div>
          <Input
            label="Mật khẩu mới"
            value={resetPassword}
            onChange={setResetPassword}
            type="password"
            placeholder="Ít nhất 6 ký tự"
          />
          <button
            onClick={() => {
              const target = users.find((u) => u.id === resetUserId);
              if (target) handleResetPassword(target);
            }}
            disabled={!canAdmin('admin.reset_password')}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60"
          >
            <KeyRound size={14} />
            Reset mật khẩu
          </button>
          {resetResult && <p className="mt-2 text-xs text-slate-600">{resetResult}</p>}
        </div>
      </div>
    )}

  </>;
}
