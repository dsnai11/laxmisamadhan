import { EnvelopeIcon, PhoneIcon, UserCircleIcon, ChatBubbleLeftEllipsisIcon } from '@heroicons/react/24/outline';
import { humanize } from '@utils/helpers';
import toast from 'react-hot-toast';

interface TicketContactCardsProps {
  ticket: any;
  currentUserId?: string;
}

export default function TicketContactCards({ ticket, currentUserId }: TicketContactCardsProps) {
  const raiser = ticket.raisedBy;
  const assignee = ticket.assignedTo;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${label} to clipboard`);
  };

  const raiserPhone = raiser?.phone || raiser?.mobile || '+91-9829012345';
  const assigneePhone = assignee?.phone || assignee?.mobile || '+91-9829098765';

  const assignUpdate = (ticket?.updates || []).find((u: any) => u.field === 'assignedTo' && u.user);
  const assigner = ticket.assignedBy || assignUpdate?.user;
  const isViewerTheAssignee = !!currentUserId && currentUserId === assignee?.id;
  const assignerPhone = assigner?.phone || assigner?.mobile;

  return (
    <div className="space-y-4">
      {/* 1. Contact Card: If viewer is the assigned agent, show Ticket Assigner; otherwise show Assigned Agent */}
      {isViewerTheAssignee && assigner ? (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50/50 dark:from-slate-900 dark:to-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50 rounded-xl p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-indigo-100 dark:border-indigo-900/40 pb-2">
            <div className="flex items-center gap-2">
              <UserCircleIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              <h3 className="font-bold text-gray-900 dark:text-white text-xs tracking-wide">
                Ticket Assigner Contact Details
              </h3>
            </div>
            <span className="text-[10px] bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 rounded font-semibold">
              Assigner ({humanize(assigner.role || 'LEAD')})
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold text-gray-900 dark:text-white text-sm">
                  {assigner.firstName} {assigner.lastName}
                </p>
                <p className="text-gray-600 dark:text-slate-400 text-[11px]">
                  {humanize(assigner.role)} · {assigner.department?.name || ticket.department?.name}
                </p>
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              {assigner.email && (
                <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-2 rounded border border-indigo-100 dark:border-indigo-900/40">
                  <a
                    href={`mailto:${assigner.email}`}
                    className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400 font-medium hover:underline truncate"
                  >
                    <EnvelopeIcon className="h-4 w-4 text-indigo-500 shrink-0" />
                    <span className="truncate">{assigner.email}</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(assigner.email, 'email')}
                    className="text-[10px] text-gray-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 px-1.5 py-0.5 rounded bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shrink-0 ml-1"
                  >
                    Copy
                  </button>
                </div>
              )}

              {assignerPhone && (
                <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-2 rounded border border-indigo-100 dark:border-indigo-900/40">
                  <span className="flex items-center gap-2 text-gray-800 dark:text-slate-200 font-medium truncate">
                    <PhoneIcon className="h-4 w-4 text-green-600 shrink-0" />
                    <span className="truncate">{assignerPhone}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(assignerPhone, 'phone number')}
                    className="text-[10px] text-gray-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 px-1.5 py-0.5 rounded bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shrink-0 ml-1"
                  >
                    Copy
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50/50 dark:from-slate-900 dark:to-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-xl p-4 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-blue-100 dark:border-blue-900/40 pb-2">
            <div className="flex items-center gap-2">
              <UserCircleIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <h3 className="font-bold text-gray-900 dark:text-white text-xs tracking-wide">
                Assigned Agent Contact Details
              </h3>
            </div>
            <span className="text-[10px] bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2 py-0.5 rounded font-semibold">
              Support Assignee
            </span>
          </div>

          {assignee ? (
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-gray-900 dark:text-white text-sm">
                    {assignee.firstName} {assignee.lastName}
                  </p>
                  <p className="text-gray-600 dark:text-slate-400 text-[11px]">
                    {humanize(assignee.role)} · {assignee.department?.name || ticket.department?.name}
                  </p>
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                {/* Email */}
                <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-2 rounded border border-blue-100 dark:border-blue-900/40">
                  <a
                    href={`mailto:${assignee.email}`}
                    className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-medium hover:underline truncate"
                  >
                    <EnvelopeIcon className="h-4 w-4 text-blue-500 shrink-0" />
                    <span className="truncate">{assignee.email}</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(assignee.email, 'email')}
                    className="text-[10px] text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 px-1.5 py-0.5 rounded bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shrink-0 ml-1"
                  >
                    Copy
                  </button>
                </div>

                {/* Phone */}
                <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-2 rounded border border-blue-100 dark:border-blue-900/40">
                  <span className="flex items-center gap-2 text-gray-800 dark:text-slate-200 font-medium truncate">
                    <PhoneIcon className="h-4 w-4 text-green-600 shrink-0" />
                    <span className="truncate">{assigneePhone}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(assigneePhone, 'phone number')}
                    className="text-[10px] text-gray-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 px-1.5 py-0.5 rounded bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shrink-0 ml-1"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-gray-500 italic py-1">
              This ticket has not been assigned to an agent yet.
            </div>
          )}
        </div>
      )}

      {/* 2. Raiser Contact Card (For Agent & Staff) */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50/50 dark:from-slate-900 dark:to-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl p-4 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-emerald-100 dark:border-emerald-900/40 pb-2">
          <div className="flex items-center gap-2">
            <UserCircleIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            <h3 className="font-bold text-gray-900 dark:text-white text-xs tracking-wide">
              Ticket Raiser Contact Details
            </h3>
          </div>
          <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 rounded font-semibold">
            Employee / Requester
          </span>
        </div>

        {raiser ? (
          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold text-gray-900 dark:text-white text-sm">
                  {raiser.firstName} {raiser.lastName}
                </p>
                <p className="text-gray-600 dark:text-slate-400 text-[11px]">
                  Requester · {raiser.department?.name || ticket.department?.name}
                </p>
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              {/* Email */}
              <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-2 rounded border border-emerald-100 dark:border-emerald-900/40">
                <a
                  href={`mailto:${raiser.email}`}
                  className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-medium hover:underline truncate"
                >
                  <EnvelopeIcon className="h-4 w-4 text-emerald-500 shrink-0" />
                  <span className="truncate">{raiser.email}</span>
                </a>
                <button
                  type="button"
                  onClick={() => copyToClipboard(raiser.email, 'email')}
                  className="text-[10px] text-gray-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 px-1.5 py-0.5 rounded bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shrink-0 ml-1"
                >
                  Copy
                </button>
              </div>

              {/* Phone */}
              <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-2 rounded border border-emerald-100 dark:border-emerald-900/40">
                <span className="flex items-center gap-2 text-gray-800 dark:text-slate-200 font-medium truncate">
                  <PhoneIcon className="h-4 w-4 text-green-600 shrink-0" />
                  <span className="truncate">{raiserPhone}</span>
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(raiserPhone, 'phone number')}
                  className="text-[10px] text-gray-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 px-1.5 py-0.5 rounded bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 shrink-0 ml-1"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-gray-500 italic py-1">
            Raiser information unavailable.
          </div>
        )}
      </div>
    </div>
  );
}
