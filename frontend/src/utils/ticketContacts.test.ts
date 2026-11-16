import { describe, it, expect } from 'vitest';
import { showsRaiserOnTop, findManualAssigner, isAutomaticAssignment } from './ticketContacts';

// Real-world shape, based on TKT-26-00063: YUSUF raised it, auto-assigned to ASHEESH,
// SUNIL is a team lead / admin who sometimes reassigns by hand.
const yusuf = { id: 'yusuf', role: 'RAISER', roles: ['RAISER'] };
const asheesh = { id: 'asheesh', role: 'AGENT', roles: ['AGENT'] };
const sunil = { id: 'sunil', role: 'TEAM_LEAD', roles: ['TEAM_LEAD'] };
const admin = { id: 'admin', role: 'SUPER_ADMIN', roles: ['SUPER_ADMIN'] };

const baseTicket = {
  raisedById: 'yusuf',
  raisedBy: yusuf,
  assignedToId: 'asheesh',
  assignedTo: asheesh,
  assignedBy: null as any,
  updates: [] as any[],
};

const row = (user: any, extra: Record<string, any> = {}) => ({
  field: 'assignedTo',
  oldValue: 'Unassigned',
  newValue: 'Asheesh Gupta',
  isSystem: false,
  user,
  ...extra,
});

describe('showsRaiserOnTop — who appears on the top card', () => {
  it('agent assigned to the ticket sees the RAISER', () => {
    expect(showsRaiserOnTop(asheesh, baseTicket)).toBe(true);
  });

  it('any agent / team lead sees the RAISER', () => {
    expect(showsRaiserOnTop(sunil, baseTicket)).toBe(true);
    expect(showsRaiserOnTop({ id: 'other-agent', role: 'AGENT' }, baseTicket)).toBe(true);
  });

  it('the raiser sees the ASSIGNED AGENT', () => {
    expect(showsRaiserOnTop(yusuf, baseTicket)).toBe(false);
  });

  it('a staff member who raised the ticket themselves sees the ASSIGNED AGENT', () => {
    const agentAsRaiser = { id: 'yusuf', role: 'AGENT', roles: ['AGENT', 'RAISER'] };
    expect(showsRaiserOnTop(agentAsRaiser, baseTicket)).toBe(false);
  });

  it('an admin who is neither raiser nor assignee sees the ASSIGNED AGENT', () => {
    expect(showsRaiserOnTop(admin, baseTicket)).toBe(false);
  });

  it('an admin who is the assignee sees the RAISER', () => {
    expect(showsRaiserOnTop(admin, { ...baseTicket, assignedToId: 'admin' })).toBe(true);
  });

  it('no viewer → assigned agent', () => {
    expect(showsRaiserOnTop(null, baseTicket)).toBe(false);
  });
});

describe('findManualAssigner — never shows the raiser or the agent as "assigned by"', () => {
  it('auto-assignment (new format: isSystem, row user = assignee) → no assigner', () => {
    const t = { ...baseTicket, updates: [row(asheesh, { isSystem: true })] };
    expect(findManualAssigner(t)).toBeNull();
  });

  it('auto-assignment (old format: row user = raiser, isSystem false) → no assigner', () => {
    const t = { ...baseTicket, updates: [row(yusuf)] };
    expect(findManualAssigner(t)).toBeNull();
  });

  it('assignedBy set to the raiser (old data) → no assigner', () => {
    const t = { ...baseTicket, assignedBy: yusuf, updates: [row(yusuf)] };
    expect(findManualAssigner(t)).toBeNull();
  });

  it('assignee recorded as their own assigner → no assigner', () => {
    const t = { ...baseTicket, updates: [row(asheesh)] };
    expect(findManualAssigner(t)).toBeNull();
  });

  it('team lead assigned it by hand (assignedBy) → team lead', () => {
    const t = { ...baseTicket, assignedBy: sunil, updates: [row(sunil)] };
    expect(findManualAssigner(t)).toEqual(sunil);
  });

  it('team lead assigned it by hand (history only) → team lead', () => {
    const t = { ...baseTicket, updates: [row(sunil)] };
    expect(findManualAssigner(t)).toEqual(sunil);
  });

  it('uses the latest manual row and skips newer automatic rows', () => {
    const t = { ...baseTicket, updates: [row(asheesh, { isSystem: true }), row(sunil)] };
    expect(findManualAssigner(t)).toEqual(sunil);
  });

  it('works when only raisedBy (not raisedById) is present', () => {
    const { raisedById, ...noId } = baseTicket;
    expect(findManualAssigner({ ...noId, updates: [row(yusuf)] })).toBeNull();
  });
});

describe('isAutomaticAssignment — activity feed wording', () => {
  it('flags system rows, raiser rows and self rows as automatic', () => {
    expect(isAutomaticAssignment(row(asheesh, { isSystem: true }), baseTicket)).toBe(true);
    expect(isAutomaticAssignment(row(yusuf), baseTicket)).toBe(true);
    expect(isAutomaticAssignment(row(asheesh), baseTicket)).toBe(true);
    expect(isAutomaticAssignment(row(null), baseTicket)).toBe(true);
  });

  it('a real manual reassignment by a team lead is not automatic', () => {
    expect(isAutomaticAssignment(row(sunil), baseTicket)).toBe(false);
  });

  it('ignores non-assignment rows', () => {
    expect(isAutomaticAssignment({ field: 'status', user: yusuf }, baseTicket)).toBe(false);
  });
});

import { previousAssigneeBeforeResolution, describeAssignment } from './ticketContacts';

// TKT-26-00025: assigned to Narendra, later resolved by Asheesh -> credited to Asheesh.
const asheeshU = { id: 'asheesh', firstName: 'Asheesh', lastName: 'Gupta', role: 'AGENT' };
const kapilU = { id: 'kapil', firstName: 'kapil', lastName: 'solanki', role: 'AGENT' };
const t25 = {
  status: 'RESOLVED', raisedById: 'raiser', assignedToId: 'asheesh', resolvedBy: asheeshU,
  updates: [
    { field: 'assignedTo', oldValue: 'Narendra Saini', newValue: 'Asheesh Gupta', isSystem: false, user: asheeshU, createdAt: '2026-11-16T12:03:01Z' },
    { field: 'status', oldValue: 'REOPENED', newValue: 'RESOLVED', user: asheeshU, createdAt: '2026-11-16T10:52:00Z' },
    { field: 'assignedTo', oldValue: 'Unassigned', newValue: 'Narendra Saini', isSystem: false, user: kapilU, createdAt: '2026-10-19T06:24:00Z' },
  ],
};

describe('previousAssigneeBeforeResolution — "earlier assigned to" on resolved tickets', () => {
  it('shows who had it before the resolver took the credit', () => {
    expect(previousAssigneeBeforeResolution(t25)).toBe('Narendra Saini');
  });
  it('null when the assignee resolved it themselves', () => {
    expect(previousAssigneeBeforeResolution({ ...t25, updates: [t25.updates[2]] })).toBeNull();
  });
  it('null for tickets that are not resolved', () => {
    expect(previousAssigneeBeforeResolution({ ...t25, status: 'OPEN' })).toBeNull();
  });
});

describe('describeAssignment — activity wording always names who it moved from', () => {
  it('resolver credit row', () => {
    expect(describeAssignment(t25.updates[0], t25)).toBe('Ticket reassigned from Narendra Saini to Asheesh Gupta');
  });
  it('first assignment by a colleague', () => {
    expect(describeAssignment(t25.updates[2], t25)).toBe('kapil solanki assigned the ticket to Narendra Saini');
  });
  it('manual reassignment by a team lead', () => {
    const lead = { id: 'hari', firstName: 'Hari', lastName: 'Yadav', role: 'TEAM_LEAD' };
    expect(describeAssignment({ field: 'assignedTo', oldValue: 'Satypal Singh', newValue: 'Narendra Saini', user: lead }, { raisedById: 'r', assignedToId: 'narendra' }))
      .toBe('Hari Yadav reassigned the ticket from Satypal Singh to Narendra Saini');
  });
});
