import { describe, it, expect } from 'vitest';
import { canManageAssignment } from './assignmentRights';

const HW = 'hw', APP = 'app';
const ticket = { departmentId: HW, department: { headId: 'sunil' } };
const u = (id: string, role: string, departmentId: string | null = HW, roles: string[] = []) => ({ id, role, roles, departmentId });

describe('canManageAssignment — who sees Assign / Reassign / Transfer', () => {
  it('Super Admin and Admin: always', () => {
    expect(canManageAssignment(u('a', 'SUPER_ADMIN', null), ticket)).toBe(true);
    expect(canManageAssignment(u('b', 'ADMIN', APP), ticket)).toBe(true);
  });
  it('the ticket department\'s head and team leads', () => {
    expect(canManageAssignment(u('sunil', 'DEPARTMENT_HEAD'), ticket)).toBe(true);
    expect(canManageAssignment(u('hari', 'TEAM_LEAD'), ticket)).toBe(true);
    expect(canManageAssignment(u('x', 'AGENT', null), ticket, true)).toBe(true); // leads a team in the dept
  });
  it('never agents, raisers or viewers — even on their own department\'s tickets', () => {
    expect(canManageAssignment(u('asheesh', 'AGENT'), ticket)).toBe(false);
    expect(canManageAssignment(u('yusuf', 'RAISER'), ticket)).toBe(false);
    expect(canManageAssignment(u('v', 'VIEWER'), ticket)).toBe(false);
  });
  it('not heads / team leads of another department', () => {
    expect(canManageAssignment(u('vinod', 'DEPARTMENT_HEAD', APP), ticket)).toBe(false);
    expect(canManageAssignment(u('shailesh', 'TEAM_LEAD', APP), ticket)).toBe(false);
  });
  it('list pages (no ticket): only the four roles', () => {
    expect(['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD', 'TEAM_LEAD'].every((r) => canManageAssignment(u('p', r)))).toBe(true);
    expect(['AGENT', 'RAISER', 'VIEWER'].some((r) => canManageAssignment(u('p', r)))).toBe(false);
  });
  it('extra roles count (multi-role users)', () => {
    expect(canManageAssignment(u('m', 'AGENT', HW, ['AGENT', 'TEAM_LEAD']), ticket)).toBe(true);
  });
});
