import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

/** One modal boundary for account forms and editors; keeps keyboard focus inside. */
export default function UserManagementDialog({ title, children, onClose, busy = false }: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  const isBusy = useRef(busy);
  close.current = onClose;
  isBusy.current = busy;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (!isBusy.current) close.current(); }
      if (event.key !== 'Tab') return;
      const targets = Array.from(panel.current?.querySelectorAll<HTMLElement>('button, input, select, textarea, [tabindex="0"]') ?? [])
        .filter((element) => !element.matches(':disabled') && !element.closest('[hidden]'));
      const first = targets[0]; const last = targets[targets.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.current)) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown, true);
    return () => { document.removeEventListener('keydown', keydown, true); previous?.focus(); };
  }, []);
  return <div className="admin-user-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-busy={busy} tabIndex={-1} className="admin-user-dialog">
      <header><h2 id={titleId}>{title}</h2><button type="button" aria-label="Đóng" disabled={busy} onClick={onClose}><X size={20} aria-hidden="true" /></button></header>
      {children}
    </div>
  </div>;
}
