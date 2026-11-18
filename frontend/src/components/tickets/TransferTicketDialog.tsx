import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '@services/api';
import { Modal, getErrorMessage } from '@components/common/ui';

interface Props {
  open: boolean;
  onClose: () => void;
  ticket: any;
  onTransferred: () => void;
}

/**
 * Forward a ticket raised in the wrong department: choose the department, then its team, and
 * optionally a person in that team. Without a person the ticket is auto-assigned within the team
 * (or department). The server enforces who may do this and that team/person belong to the
 * target department (canTransferTicket / validateTransferTarget in ticket.service.ts).
 */
export default function TransferTicketDialog({ open, onClose, ticket, onTransferred }: Props) {
  const [deptId, setDeptId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [personId, setPersonId] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setDeptId(''); setTeamId(''); setPersonId(''); setReason(''); }
  }, [open]);

  const { data: departments } = useQuery({ queryKey: ['departments'], queryFn: () => api.getDepartments(), enabled: open });
  const { data: teams, isFetching: teamsLoading } = useQuery({
    queryKey: ['transfer-teams', deptId],
    queryFn: () => api.getTeams(deptId),
    enabled: open && !!deptId,
  });

  const teamList: any[] = (teams as any[]) || [];
  const people = useMemo(() => {
    const team = teamList.find((t) => t.id === teamId);
    if (!team) return [];
    const list = [...(team.lead ? [team.lead] : []), ...(team.members || [])];
    return list.filter((p, i) => list.findIndex((q) => q.id === p.id) === i);
  }, [teamList, teamId]);

  const deptName = ((departments as any[]) || []).find((d: any) => d.id === deptId)?.name;
  const teamName = teamList.find((t) => t.id === teamId)?.name;
  const personName = people.find((p: any) => p.id === personId);

  const submit = async () => {
    setBusy(true);
    try {
      await api.updateTicket(ticket.id, {
        departmentId: deptId,
        transferReason: reason.trim() || undefined,
        transferTeamId: teamId || undefined,
        transferAssigneeId: personId || undefined,
      } as any);
      toast.success(
        `Transferred to ${deptName || 'the new department'}${teamName ? ` / ${teamName}` : ''}` +
          (personName ? ` — assigned to ${personName.firstName} ${personName.lastName}` : '')
      );
      onClose();
      onTransferred();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Transfer ticket to another department"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={!deptId || busy} onClick={submit}>
            {busy ? 'Transferring…' : 'Transfer'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Currently in <span className="font-medium text-gray-900">{ticket?.department?.name || 'this department'}</span>.
          The current assignee is cleared and the new department's head is notified.
        </p>

        <div>
          <label className="label">1. Department</label>
          <select className="input" value={deptId} onChange={(e) => { setDeptId(e.target.value); setTeamId(''); setPersonId(''); }}>
            <option value="">Select the correct department…</option>
            {((departments as any[]) || [])
              .filter((d: any) => d.id !== ticket?.departmentId)
              .map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>

        {deptId && (
          <div>
            <label className="label">2. Team</label>
            {teamsLoading ? (
              <p className="text-sm text-gray-500">Loading teams…</p>
            ) : teamList.length === 0 ? (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                {deptName || 'This department'} has no teams yet. The ticket will go to the department queue.
              </p>
            ) : (
              <select className="input" value={teamId} onChange={(e) => { setTeamId(e.target.value); setPersonId(''); }}>
                <option value="">Any team (auto-assign in the department)</option>
                {teamList.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
          </div>
        )}

        {teamId && (
          <div>
            <label className="label">3. Person (optional)</label>
            <select className="input" value={personId} onChange={(e) => setPersonId(e.target.value)}>
              <option value="">Auto-assign within {teamName || 'the team'}</option>
              {people.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.firstName} {p.lastName}{p.id === teamList.find((t) => t.id === teamId)?.lead?.id ? ' (Team lead)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="label">Reason (optional)</label>
          <input className="input" placeholder="e.g. Raised in the wrong department" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}
