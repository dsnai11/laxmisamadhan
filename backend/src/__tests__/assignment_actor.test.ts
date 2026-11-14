import { describe, it, expect, vi } from 'vitest';

vi.mock('@config/prisma', () => ({ prisma: {} }));

import { resolveAssignmentActor } from '../services/ticket.service';

describe('resolveAssignmentActor — how assignments are recorded', () => {
  const raiser = 'yusuf';

  it('system auto-assignment → no assigner, isSystem', () => {
    expect(resolveAssignmentActor('Auto-assigned by system', undefined, raiser)).toEqual({ isSystem: true, assignedById: null });
  });

  it('auto-assign running in the raiser\'s request → no assigner, isSystem (raiser is never the assigner)', () => {
    expect(resolveAssignmentActor(undefined, raiser, raiser)).toEqual({ isSystem: true, assignedById: null });
    expect(resolveAssignmentActor('Auto-assigned by system', raiser, raiser)).toEqual({ isSystem: true, assignedById: null });
  });

  it('missing actor → treated as system', () => {
    expect(resolveAssignmentActor(undefined, null, raiser)).toEqual({ isSystem: true, assignedById: null });
  });

  it('team lead / admin assigning by hand → recorded as that person', () => {
    expect(resolveAssignmentActor('Reassigned', 'sunil', raiser)).toEqual({ isSystem: false, assignedById: 'sunil' });
    expect(resolveAssignmentActor(undefined, 'sunil', raiser)).toEqual({ isSystem: false, assignedById: 'sunil' });
  });
});
