import { ReactNode, useEffect } from 'react';
import { cn, getStatusColor, getPriorityColor, getSLABadgeColor, humanize } from '@utils/helpers';

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn('animate-spin rounded-full h-8 w-8 border-4 border-primary-600 border-t-transparent', className)} />
  );
}

export function PageLoader({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-500">
      <Spinner />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <h1 className="page-title break-words">{title}</h1>
        {subtitle && <p className="page-subtitle break-words">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, message, action }: { title: string; message?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 sm:py-14 px-4 text-gray-500 dark:text-slate-400 gap-2">
      <p className="text-base font-medium text-gray-900 dark:text-white">{title}</p>
      {message && <p className="text-sm max-w-md">{message}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = getErrorMessage(error);
  return (
    <div className="card p-6 text-center">
      <p className="font-medium text-danger-700 dark:text-danger-400">Something went wrong</p>
      <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">{message}</p>
      {onRetry && (
        <button className="btn-secondary btn-sm mt-4" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function getErrorMessage(error: unknown): string {
  const e = error as any;
  const details = e?.response?.data?.details;
  if (Array.isArray(details) && details.length) {
    return details.map((d: any) => (d.field ? `${d.field}: ${d.message}` : d.message)).join('; ');
  }
  return e?.response?.data?.error || e?.message || 'Unexpected error';
}

export function Pagination({ page, totalPages, total, onPageChange }: { page: number; totalPages: number; total: number; onPageChange: (page: number) => void }) {
  if (total === 0) return null;
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-4 py-3 border-t border-gray-200 dark:border-slate-800 text-xs sm:text-sm text-gray-600 dark:text-slate-400">
      <span className="truncate">
        Page {page} of {Math.max(totalPages, 1)} · {total} result{total === 1 ? '' : 's'}
      </span>
      <div className="flex gap-2">
        <button className="btn-secondary btn-sm flex-1 sm:flex-none" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Previous
        </button>
        <button className="btn-secondary btn-sm flex-1 sm:flex-none" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className={cn(
          'modal-content flex flex-col',
          wide ? 'max-w-xl sm:max-w-2xl lg:max-w-4xl' : 'max-w-lg sm:max-w-xl'
        )}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-header">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white truncate pr-2">{title}</h3>
          <button className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 text-2xl leading-none p-1 -mr-1 transition-colors" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  danger,
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm} disabled={busy}>
            {busy ? 'Working...' : confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-gray-600 dark:text-slate-300">{message}</p>
    </Modal>
  );
}

export function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  return <span className={cn('badge', getStatusColor(status))}>{humanize(status)}</span>;
}

export function PriorityBadge({ priority }: { priority?: string }) {
  if (!priority) return null;
  return <span className={cn('badge', getPriorityColor(priority))}>{humanize(priority)}</span>;
}

export function SLABadge({ status, isOverdue }: { status?: string; isOverdue?: boolean }) {
  if (!status && !isOverdue) return null;
  const isBreachedOrOverdue = isOverdue || status === 'BREACHED';
  const effectiveStatus = isBreachedOrOverdue ? 'BREACHED' : status || 'WITHIN_SLA';
  const label = isBreachedOrOverdue ? 'Overdue' : humanize(effectiveStatus);
  return (
    <span className={cn('badge inline-flex items-center gap-1 font-semibold', getSLABadgeColor(effectiveStatus))}>
      {isBreachedOrOverdue && <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />}
      {label}
    </span>
  );
}

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">{hint}</p>}
      {error && <p className="mt-1 text-sm text-danger-600 dark:text-danger-400">{error}</p>}
    </div>
  );
}

export function Avatar({ firstName, lastName, size = 8 }: { firstName?: string; lastName?: string; size?: number }) {
  const initials = `${(firstName || '').charAt(0)}${(lastName || '').charAt(0)}`.toUpperCase() || '?';
  return (
    <div
      className="rounded-full bg-primary-100 dark:bg-primary-950/70 text-primary-700 dark:text-primary-300 border border-transparent dark:border-primary-800/60 flex items-center justify-center font-medium text-xs shrink-0"
      style={{ width: size * 4, height: size * 4 }}
    >
      {initials}
    </div>
  );
}

export const STATUS_OPTIONS = ['OPEN', 'RESOLVED', 'REOPENED', 'DEPENDENCY_ON_CLIENT'];
export const PRIORITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'URGENT'];
export const CATEGORY_OPTIONS = ['INCIDENT', 'SERVICE_REQUEST', 'CHANGE_REQUEST', 'PROBLEM', 'ACCESS_REQUEST', 'HARDWARE_REQUEST', 'SOFTWARE_REQUEST', 'SECURITY_INCIDENT', 'AI_MODEL_REQUEST', 'DATA_REQUEST'];
export const ROLE_OPTIONS = ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD', 'TEAM_LEAD', 'AGENT', 'RAISER', 'VIEWER'];
export const USER_STATUS_OPTIONS = ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION'];
export const STAFF_ROLES = ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD', 'TEAM_LEAD', 'AGENT'];

export const ROLE_RANK: Record<string, number> = { SUPER_ADMIN: 100, ADMIN: 90, DEPARTMENT_HEAD: 70, TEAM_LEAD: 50, AGENT: 40, RAISER: 20, VIEWER: 10 };

export function assignableRoles(actorRole?: string): string[] {
  if (actorRole === 'SUPER_ADMIN') return ROLE_OPTIONS;
  return ROLE_OPTIONS.filter((r) => (ROLE_RANK[r] ?? 0) < (ROLE_RANK[actorRole || ''] ?? 0));
}

export function canManageRole(actorRole?: string, targetRole?: string): boolean {
  if (actorRole === 'SUPER_ADMIN') return true;
  return (ROLE_RANK[targetRole || ''] ?? 0) < (ROLE_RANK[actorRole || ''] ?? 0);
}
