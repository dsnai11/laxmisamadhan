import { useState } from 'react';
import toast from 'react-hot-toast';
import api from '@services/api';
import { useAuth } from '@context/AuthContext';
import TicketListPage from '@components/tickets/TicketListPage';
import { getErrorMessage } from '@components/common/ui';

export default function TicketQueue({ basePath, title, subtitle }: { basePath: string; title: string; subtitle: string }) {
  const { user } = useAuth();
  const [unassignedOnly, setUnassignedOnly] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const userRoles = Array.from(new Set([
    ...(user?.role ? [user.role] : []),
    ...(user?.roles || [])
  ]));
  const canAssign = userRoles.some(r => ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD', 'TEAM_LEAD'].includes(r));

  const claim = async (ticketId: string, refetch: () => void) => {
    if (!user) return;
    setBusyId(ticketId);
    try {
      await api.assignTicket(ticketId, user.id);
      toast.success('Ticket assigned to you');
      refetch();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <TicketListPage
      title={title}
      subtitle={subtitle}
      queryKey="ticket-queue"
      fetcher={(params) => api.getTickets(params)}
      basePath={basePath}
      showRaiser
      showAssignee
      extraParams={unassignedOnly ? { unassigned: 'true' } : undefined}
      emptyMessage={unassignedOnly ? 'The queue is clear. There are no unassigned tickets.' : 'No tickets to show.'}
      actions={
        <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            checked={unassignedOnly}
            onChange={(e) => setUnassignedOnly(e.target.checked)}
          />
          Unassigned only
        </label>
      }
      renderRowAction={canAssign ? (ticket, refetch) =>
        !ticket.assignedToId && ['OPEN', 'REOPENED'].includes(ticket.status) ? (
          <button className="btn-primary btn-sm" disabled={busyId === ticket.id} onClick={() => claim(ticket.id, refetch)}>
            {busyId === ticket.id ? 'Assigning...' : 'Take'}
          </button>
        ) : null
      : undefined}
    />
  );
}
