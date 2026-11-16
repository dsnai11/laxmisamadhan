// Who-is-shown rules for the ticket detail page. Kept here (not inside components) so
// they are unit-tested — see ticketContacts.test.ts. These rules regressed repeatedly:
//  - auto-assignments are stored as history rows with isSystem=true and the ASSIGNEE's id as
//    the row user (the column is required); older rows used the RAISER's id. Neither person
//    actually assigned the ticket, so such rows must never be shown as "assigned by".
//  - agents see the raiser on the top card; raisers see the assigned agent.

type Person = { id?: string; role?: string; roles?: string[] } | null | undefined;

const roleSet = (u: Person): string[] =>
  Array.from(new Set([...(u?.role ? [u.role] : []), ...(u?.roles || [])]));

/**
 * Top card: true -> show the RAISER ("Ticket Raised By"), false -> show the assigned agent.
 *  - the viewer raised the ticket            -> false (they want to see who is helping them)
 *  - agent / team lead / the ticket assignee -> true  (they want to see whom they are helping)
 *  - anyone else (e.g. admins)               -> false
 */
export function showsRaiserOnTop(viewer: Person, ticket: any): boolean {
  if (!viewer?.id || viewer.id === ticket?.raisedById) return false;
  return roleSet(viewer).some((r) => r === 'AGENT' || r === 'TEAM_LEAD') || viewer.id === ticket?.assignedToId;
}

/** True for a history row that records a system/auto assignment rather than a person's action. */
export function isAutomaticAssignment(update: any, ticket: any): boolean {
  if (update?.field !== 'assignedTo') return false;
  const by = update?.user;
  return (
    !!update?.isSystem ||
    !by ||
    by.id === ticket?.raisedById ||
    by.role === 'RAISER' ||
    by.id === ticket?.assignedToId
  );
}

/**
 * The person who manually assigned the ticket, or null if it was auto-assigned.
 * Uses ticket.assignedBy when it is a real staff assigner, else the latest manual history row.
 */
export function findManualAssigner(ticket: any): any | null {
  const raiserId = ticket?.raisedById ?? ticket?.raisedBy?.id;
  const by = ticket?.assignedBy;
  if (by && by.id !== raiserId && by.role !== 'RAISER') return by;

  const row = (ticket?.updates || []).find(
    (u: any) => u.field === 'assignedTo' && !isAutomaticAssignment(u, { ...ticket, raisedById: raiserId })
  );
  return row?.user ?? null;
}

const isRealName = (v?: string | null) => !!v && !/^(unassigned|-|null)$/i.test(v.trim());
const fullNameOf = (u: any) => (u ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : '');

/**
 * Who had the ticket before the person who resolved it took it over (resolver credit),
 * e.g. "Narendra Saini" for a ticket assigned to Narendra but resolved by Asheesh. Null if the
 * resolver was already the assignee. `updates` may be in any order.
 */
export function previousAssigneeBeforeResolution(ticket: any): string | null {
  if (ticket?.status !== 'RESOLVED' || !ticket?.resolvedBy) return null;
  const resolverName = fullNameOf(ticket.resolvedBy);
  const rows = [...(ticket.updates || [])]
    .filter((u: any) => u.field === 'assignedTo' && isRealName(u.oldValue) && u.newValue === resolverName && u.oldValue !== resolverName)
    .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return rows[0]?.oldValue ?? null;
}

/** Activity-feed wording for an assignment row. Always says who it moved from when known. */
export function describeAssignment(update: any, ticket: any): string {
  const to = update?.newValue || 'support agent';
  const from = isRealName(update?.oldValue) ? update.oldValue : null;
  const actor = fullNameOf(update?.user);
  if (isAutomaticAssignment(update, ticket) || !actor) {
    return from ? `Ticket reassigned from ${from} to ${to}` : `Ticket assigned to ${to}`;
  }
  return from ? `${actor} reassigned the ticket from ${from} to ${to}` : `${actor} assigned the ticket to ${to}`;
}
