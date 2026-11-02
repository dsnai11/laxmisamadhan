import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { formatRelativeTime, humanize, getStatusColor, getPriorityColor, getSLABadgeColor } from '@utils/helpers';
import { Avatar, PriorityBadge, SLABadge, StatusBadge } from '@components/common/ui';

interface KanbanViewProps {
  tickets: any[];
  basePath: string;
  onStatusChange?: (ticketId: string, newStatus: string) => void;
}

const KANBAN_COLUMNS = [
  { id: 'OPEN', title: 'Open', color: 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300' },
  { id: 'DEPENDENCY_ON_CLIENT', title: 'Dependency on User', color: 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300' },
  { id: 'DEPENDENCY_ON_VENDOR', title: 'Dependency on Vendor', color: 'border-purple-500 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300' },
  { id: 'RESOLVED', title: 'Resolved', color: 'border-green-500 bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300' },
  { id: 'REOPENED', title: 'Reopen', color: 'border-red-500 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300' },
];

export default function KanbanView({ tickets, basePath, onStatusChange }: KanbanViewProps) {
  const navigate = useNavigate();

  return (
    <div className="flex md:grid md:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 overflow-x-auto pb-4 max-w-full scrollbar-thin snap-x">
      {KANBAN_COLUMNS.map((col) => {
        const columnTickets = tickets.filter((t) => t.status === col.id);
        return (
          <div key={col.id} className="bg-gray-50/80 dark:bg-slate-900/60 rounded-xl p-3 border border-gray-200 dark:border-slate-800 flex flex-col w-[270px] sm:w-[280px] md:w-auto shrink-0 md:shrink min-h-[420px] sm:min-h-[500px] snap-start">
            {/* Column Header */}
            <div className={`flex items-center justify-between px-3 py-2 rounded-lg mb-3 border-l-4 ${col.color}`}>
              <span className="font-semibold text-sm">{col.title}</span>
              <span className="bg-white/80 dark:bg-slate-800 px-2 py-0.5 rounded-full text-xs font-bold shadow-sm dark:text-slate-200">{columnTickets.length}</span>
            </div>

            {/* Column Cards */}
            <div className="space-y-3 flex-1 overflow-y-auto">
              {columnTickets.length === 0 ? (
                <div className="text-center py-8 text-xs text-gray-400 dark:text-slate-500 border border-dashed border-gray-200 dark:border-slate-800 rounded-lg">
                  No tickets
                </div>
              ) : (
                columnTickets.map((ticket) => (
                  <div
                    key={ticket.id}
                    onClick={() => navigate(`${basePath}/${ticket.id}`)}
                    className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all cursor-pointer group hover:border-primary-300 dark:hover:border-primary-700 relative"
                  >
                    {/* Top Row: Ticket Number & Priority */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-xs font-semibold text-primary-600 dark:text-primary-400 group-hover:underline">
                        {ticket.ticketNumber}
                      </span>
                      <PriorityBadge priority={ticket.priority} />
                    </div>

                    {/* Title */}
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2 leading-snug">
                      {ticket.title}
                    </h4>

                    {/* Department Tag */}
                    <div className="flex items-center gap-1.5 mb-3">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ticket.department?.color || '#3B82F6' }} />
                      <span className="text-xs text-gray-500 dark:text-slate-400 font-medium truncate">{ticket.department?.name}</span>
                    </div>

                    {/* SLA Badge */}
                    {(ticket.slaStatus || (ticket.resolutionDueAt && !ticket.resolvedAt && new Date(ticket.resolutionDueAt).getTime() < Date.now())) && (
                      <div className="mb-3">
                        <SLABadge
                          status={ticket.slaStatus}
                          isOverdue={
                            ticket.slaStatus === 'BREACHED' ||
                            (ticket.resolutionDueAt &&
                              !ticket.resolvedAt &&
                              new Date(ticket.resolutionDueAt).getTime() < Date.now())
                          }
                        />
                      </div>
                    )}

                    {/* Footer Row: Assignee & Date */}
                    <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-slate-800 text-xs text-gray-500 dark:text-slate-400">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {ticket.assignedTo ? (
                          <>
                            <Avatar firstName={ticket.assignedTo.firstName} lastName={ticket.assignedTo.lastName} size={5} />
                            <span className="truncate">{ticket.assignedTo.firstName}</span>
                          </>
                        ) : (
                          <span className="text-gray-400 dark:text-slate-500 italic">Unassigned</span>
                        )}
                      </div>
                      <span className="shrink-0">{formatRelativeTime(ticket.updatedAt)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
