// Ticket search rules shared by the header search bar and the ticket lists.
// Unit-tested in ticketSearch.test.ts.

/**
 * Tidy what the user typed. A ticket number typed loosely ("tkt 26 83", "TKT-26-83",
 * "tkt2600083") becomes the real number "TKT-26-00083"; anything else is just trimmed.
 */
export function normalizeTicketSearch(input: string | null | undefined): string {
  const q = (input || '').trim();
  const m = q.match(/^tkt[\s_-]*(\d{2})[\s_-]+(\d{1,6})$/i) || q.match(/^tkt(\d{2})(\d{5})$/i);
  if (m) return `TKT-${m[1]}-${m[2].padStart(5, '0')}`;
  return q;
}

/** Where the header search bar sends each role (the list page reads ?search=). */
export function headerSearchTarget(input: string, roles: string[]): string | null {
  const q = normalizeTicketSearch(input);
  if (!q) return null;
  const isAdmin = roles.some((r) => ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD'].includes(r));
  const isAgent = roles.some((r) => ['AGENT', 'TEAM_LEAD'].includes(r));
  const base = isAdmin ? '/admin/tickets' : isAgent ? '/agent/my-assignments' : '/raiser/my-tickets';
  return `${base}?search=${encodeURIComponent(q)}`;
}

/**
 * Status filter of the admin "All Tickets" tab. While searching, the tab filter is
 * ignored so a ticket is found whatever its status (the default "Pending" tab used to
 * hide every ticket that was not waiting on the client).
 */
export function adminTabStatus(activeTab: string, search: string): string | undefined {
  if (search.trim()) return undefined;
  if (activeTab === 'open') return 'OPEN';
  if (activeTab === 'pending') return 'DEPENDENCY_ON_CLIENT';
  return undefined;
}
