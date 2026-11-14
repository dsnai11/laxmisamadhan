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
