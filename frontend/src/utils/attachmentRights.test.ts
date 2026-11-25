import { describe, it, expect } from 'vitest';
import { canRemoveAttachment } from './attachmentRights';

describe('canRemoveAttachment', () => {
  it('only Super Admin and Admin see the Remove button', () => {
    expect(canRemoveAttachment(['SUPER_ADMIN'])).toBe(true);
    expect(canRemoveAttachment(['AGENT', 'ADMIN'])).toBe(true);
  });
  it('raiser, agent, team lead, department head cannot — even for their own upload', () => {
    for (const r of ['RAISER', 'AGENT', 'TEAM_LEAD', 'DEPARTMENT_HEAD', 'VIEWER']) expect(canRemoveAttachment([r])).toBe(false);
    expect(canRemoveAttachment([])).toBe(false);
    expect(canRemoveAttachment(undefined)).toBe(false);
  });
});
