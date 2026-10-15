import { EnvelopeIcon, PhoneIcon, UserCircleIcon, CheckBadgeIcon, ClockIcon, UserPlusIcon } from '@heroicons/react/24/outline';
import { humanize, formatDate } from '@utils/helpers';
import { useAuth } from '@context/AuthContext';
import toast from 'react-hot-toast';

interface AssignedAgentTopTileProps {
  ticket: any;
}

export default function AssignedAgentTopTile({ ticket }: AssignedAgentTopTileProps) {
  const { user } = useAuth();
  const assignee = ticket?.assignedTo;

  const userRoles = Array.from(new Set([
    ...(user?.role ? [user.role] : []),
    ...(user?.roles || [])
  ]));
  const isAgentOrStaff = userRoles.some((r) => ['AGENT', 'TEAM_LEAD'].includes(r)) || user?.id === ticket?.assignedToId;

  // Locate assigner from ticket.assignedBy or audit updates
  const assignUpdate = (ticket?.updates || []).find((u: any) => u.field === 'assignedTo' && u.user);
  const assigner = ticket?.assignedBy || assignUpdate?.user;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${label} to clipboard`);
  };

  const handlePhoneClick = (phone: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const isMobileDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobileDevice) {
      window.location.href = `tel:${phone}`;
    } else {
      navigator.clipboard.writeText(phone);
      toast.success(`Copied phone number (${phone}) to clipboard`);
    }
  };

  // If viewed on agent profile and ticket is assigned, display Ticket Assigned By
  if (isAgentOrStaff) {
    const isAutoAssigned = !assigner && !!assignee;
    const assignerName = assigner
      ? `${assigner.firstName} ${assigner.lastName}`
      : (isAutoAssigned ? 'System (Auto-Assignment)' : 'Unassigned');
    const assignerPhone = assigner?.phone || assigner?.mobile;
    const assignerRole = assigner?.role ? humanize(assigner.role) : (isAutoAssigned ? 'Automated Rule' : 'Department');
    const assignerDept = assigner?.department?.name || ticket?.department?.name;

    return (
      <div className="card p-4 sm:p-5 bg-gradient-to-r from-indigo-50/90 via-purple-50/30 to-white dark:from-slate-900 dark:via-indigo-950/20 dark:to-slate-900 border border-indigo-200/80 dark:border-indigo-900/50 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Left Section: Assigner Avatar and Identity */}
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="relative shrink-0">
              {assigner ? (
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 text-white font-bold flex items-center justify-center text-base shadow-sm ring-2 ring-white dark:ring-slate-800">
                  {`${assigner.firstName?.[0] || ''}${assigner.lastName?.[0] || ''}`.toUpperCase()}
                </div>
              ) : isAutoAssigned ? (
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-sm ring-2 ring-white dark:ring-slate-800">
                  AUTO
                </div>
              ) : (
                <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-400 flex items-center justify-center shadow-2xs">
                  <ClockIcon className="w-6 h-6 text-amber-500" />
                </div>
              )}
              {assigner && (
                <span
                  className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-indigo-500 border-2 border-white dark:border-slate-800 rounded-full"
                  title="Ticket Assigner"
                />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-0.5">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-400 flex items-center gap-1">
                  <UserPlusIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400 inline" />
                  Ticket Assigned By
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                    assigner
                      ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/70 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                      : isAutoAssigned
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                  }`}
                >
                  {assigner ? `Assigner (${assignerRole})` : (isAutoAssigned ? 'Auto-Assigned by System' : 'Awaiting Assignment')}
                </span>
              </div>

              {assignee ? (
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white truncate flex items-center gap-1.5">
                    {assignerName}
                    {assigner && <CheckBadgeIcon className="w-4 h-4 text-indigo-500 shrink-0" title="Verified Staff" />}
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-slate-400 truncate mt-0.5">
                    <span className="font-medium text-gray-700 dark:text-slate-300">{assignerRole}</span>
                    {assignerDept ? ` · ${assignerDept}` : ''}
                    {assigner?.employeeId ? ` · ID: ${assigner.employeeId}` : ''}
                    {ticket.assignedAt ? ` · ${formatDate(ticket.assignedAt, 'datetime')}` : ''}
                  </p>
                </div>
              ) : (
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-200">This ticket has not been assigned yet</h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                    Currently queued in <span className="font-medium text-gray-700 dark:text-slate-300">{ticket?.department?.name || 'department'}</span>.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Section: Contact pills or assignment badge */}
          {assigner && (
            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-indigo-100/80 dark:border-indigo-900/40">
              {assignerPhone && (
                <div className="flex items-center bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-slate-700 shadow-2xs gap-2">
                  <PhoneIcon className="h-4 w-4 text-emerald-600 shrink-0" />
                  <button
                    type="button"
                    onClick={(e) => handlePhoneClick(assignerPhone, e)}
                    className="text-xs font-semibold text-gray-800 dark:text-slate-200 hover:text-indigo-600 transition-colors cursor-pointer text-left"
                    title="Click to copy phone number"
                  >
                    {assignerPhone}
                  </button>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(assignerPhone, 'phone number')}
                    className="text-[10px] text-gray-500 dark:text-slate-400 hover:text-indigo-700 px-1.5 py-0.5 rounded bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 ml-1 hover:bg-indigo-50 transition-colors font-medium"
                    title="Copy phone number"
                  >
                    Copy
                  </button>
                </div>
              )}

              {assigner.email && (
                <div className="flex items-center bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-indigo-200 dark:border-slate-700 shadow-2xs gap-2">
                  <EnvelopeIcon className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <a
                    href={`mailto:${assigner.email}`}
                    className="text-xs font-semibold text-indigo-700 dark:text-indigo-400 hover:underline max-w-[180px] sm:max-w-xs truncate"
                    title="Email Assigner"
                  >
                    {assigner.email}
                  </a>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(assigner.email, 'email address')}
                    className="text-[10px] text-gray-500 dark:text-slate-400 hover:text-indigo-700 px-1.5 py-0.5 rounded bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 ml-1 hover:bg-indigo-50 transition-colors font-medium"
                    title="Copy email address"
                  >
                    Copy
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Fallback for Raiser profile: Displays Assigned Support Agent
  const assigneePhone = assignee?.phone || assignee?.mobile || '+91-9829098765';
  const departmentName = assignee?.department?.name || ticket?.department?.name;

  return (
    <div className="card p-4 sm:p-5 bg-gradient-to-r from-blue-50/90 via-indigo-50/40 to-white dark:from-slate-900 dark:via-blue-950/20 dark:to-slate-900 border border-blue-200/80 dark:border-blue-900/50 shadow-xs">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left Section: Agent Avatar and Identity */}
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="relative shrink-0">
            {assignee ? (
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-bold flex items-center justify-center text-base shadow-sm ring-2 ring-white dark:ring-slate-800">
                {`${assignee.firstName?.[0] || ''}${assignee.lastName?.[0] || ''}`.toUpperCase()}
              </div>
            ) : (
              <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-400 flex items-center justify-center shadow-2xs">
                <ClockIcon className="w-6 h-6 text-amber-500" />
              </div>
            )}
            {assignee && (
              <span
                className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-slate-800 rounded-full"
                title="Active Support Agent"
              />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400 flex items-center gap-1">
                <UserCircleIcon className="w-4 h-4 text-blue-600 dark:text-blue-400 inline" />
                Assigned Support Agent
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                  assignee
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                }`}
              >
                {assignee ? 'Support Assignee' : 'Awaiting Assignment'}
              </span>
            </div>

            {assignee ? (
              <div>
                <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white truncate flex items-center gap-1.5">
                  {assignee.firstName} {assignee.lastName}
                  <CheckBadgeIcon className="w-4 h-4 text-blue-500 shrink-0" title="Verified Support Staff" />
                </h3>
                <p className="text-xs text-gray-600 dark:text-slate-400 truncate mt-0.5">
                  <span className="font-medium text-gray-700 dark:text-slate-300">{humanize(assignee.role || 'AGENT')}</span>
                  {departmentName ? ` · ${departmentName}` : ''}
                  {assignee.employeeId ? ` · ID: ${assignee.employeeId}` : ''}
                </p>
              </div>
            ) : (
              <div>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-200">This ticket has not been assigned yet</h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  Currently queued in <span className="font-medium text-gray-700 dark:text-slate-300">{ticket?.department?.name || 'department'}</span>. A support agent will pick it up shortly.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Section: Direct Contact Action Pills */}
        {assignee && (
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-blue-100/80 dark:border-blue-900/40">
            {/* Phone Pill */}
            <div className="flex items-center bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-slate-700 shadow-2xs gap-2">
              <PhoneIcon className="h-4 w-4 text-emerald-600 shrink-0" />
              <button
                type="button"
                onClick={(e) => handlePhoneClick(assigneePhone, e)}
                className="text-xs font-semibold text-gray-800 dark:text-slate-200 hover:text-blue-600 transition-colors cursor-pointer text-left"
                title="Click to copy phone number"
              >
                {assigneePhone}
              </button>
              <button
                type="button"
                onClick={() => copyToClipboard(assigneePhone, 'phone number')}
                className="text-[10px] text-gray-500 dark:text-slate-400 hover:text-blue-700 px-1.5 py-0.5 rounded bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 ml-1 hover:bg-blue-50 transition-colors font-medium"
                title="Copy phone number"
              >
                Copy
              </button>
            </div>

            {/* Email Pill */}
            <div className="flex items-center bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-blue-200 dark:border-slate-700 shadow-2xs gap-2">
              <EnvelopeIcon className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <a
                href={`mailto:${assignee.email}`}
                className="text-xs font-semibold text-blue-700 dark:text-blue-400 hover:underline max-w-[180px] sm:max-w-xs truncate"
                title="Email Agent"
              >
                {assignee.email}
              </a>
              <button
                type="button"
                onClick={() => copyToClipboard(assignee.email, 'email address')}
                className="text-[10px] text-gray-500 dark:text-slate-400 hover:text-blue-700 px-1.5 py-0.5 rounded bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 ml-1 hover:bg-blue-50 transition-colors font-medium"
                title="Copy email address"
              >
                Copy
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
