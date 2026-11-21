import { describe, it, expect } from 'vitest';
import { normalizeTicketSearch, headerSearchTarget, adminTabStatus } from './ticketSearch';

describe('normalizeTicketSearch', () => {
  it('keeps a full ticket number', () => {
    expect(normalizeTicketSearch(' TKT-26-00083 ')).toBe('TKT-26-00083');
  });
  it('fixes loosely typed ticket numbers', () => {
    expect(normalizeTicketSearch('tkt 26 83')).toBe('TKT-26-00083');
    expect(normalizeTicketSearch('TKT-26-83')).toBe('TKT-26-00083');
    expect(normalizeTicketSearch('tkt2600083')).toBe('TKT-26-00083');
  });
  it('leaves other text alone', () => {
    expect(normalizeTicketSearch('00083')).toBe('00083');
    expect(normalizeTicketSearch('printer not working')).toBe('printer not working');
    expect(normalizeTicketSearch(null)).toBe('');
  });
});

describe('headerSearchTarget — the header search bar goes to a list that reads ?search=', () => {
  it('admins, department heads -> All Tickets', () => {
    expect(headerSearchTarget('TKT-26-00083', ['SUPER_ADMIN'])).toBe('/admin/tickets?search=TKT-26-00083');
    expect(headerSearchTarget('tkt 26 83', ['DEPARTMENT_HEAD'])).toBe('/admin/tickets?search=TKT-26-00083');
  });
  it('agents and team leads -> My Assignments; raisers -> My Tickets', () => {
    expect(headerSearchTarget('83', ['AGENT'])).toBe('/agent/my-assignments?search=83');
    expect(headerSearchTarget('vpn issue', ['RAISER'])).toBe('/raiser/my-tickets?search=vpn%20issue');
  });
  it('empty input does nothing', () => {
    expect(headerSearchTarget('   ', ['ADMIN'])).toBeNull();
  });
});

describe('adminTabStatus — searching ignores the tab filter', () => {
  it('default Pending tab hides non-waiting tickets only when not searching', () => {
    expect(adminTabStatus('pending', '')).toBe('DEPENDENCY_ON_CLIENT');
    expect(adminTabStatus('pending', 'TKT-26-00090')).toBeUndefined();
    expect(adminTabStatus('open', '')).toBe('OPEN');
    expect(adminTabStatus('open', 'x')).toBeUndefined();
    expect(adminTabStatus('amc', '')).toBeUndefined();
  });
});
