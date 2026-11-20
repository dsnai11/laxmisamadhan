import { describe, it, expect, vi } from 'vitest';

vi.mock('@config/prisma', () => ({ prisma: {} }));

import { slaPauseTransition, slaBreachedWhere, slaApproachingWhere, SLA_PAUSE_STATUSES } from '../services/sla.service';
import { deptHeadGraceElapsed, DEPT_HEAD_GRACE_MINUTES } from '../services/escalation.service';

const at = (s: string) => new Date(s);
const H = 60 * 60 * 1000;

// TKT-26-00083 (18 Nov, times in UTC): responded 09:51, set to Dependency on Client 10:05,
// resolution due 17:00 (22:30 IST). It breached at 17:00 while waiting on the raiser.
const t83 = {
  status: 'OPEN',
  slaStatus: 'WITHIN_SLA',
  slaPausedAt: null as Date | null,
  respondedAt: at('2026-11-18T09:51:07Z'),
  responseDueAt: at('2026-11-18T10:20:00Z'),
  resolutionDueAt: at('2026-11-18T17:00:00Z'),
};

describe('slaPauseTransition — SLA pauses while waiting on the client or vendor (all departments)', () => {
  it('moving to Dependency on Client pauses the clock', () => {
    const now = at('2026-11-18T10:05:00Z');
    expect(slaPauseTransition(t83, 'DEPENDENCY_ON_CLIENT', now)).toEqual({ slaPausedAt: now, slaStatus: 'PAUSED' });
  });

  it('Dependency on Vendor pauses too', () => {
    expect(slaPauseTransition(t83, 'DEPENDENCY_ON_VENDOR', at('2026-11-18T10:05:00Z')).slaStatus).toBe('PAUSED');
    expect(SLA_PAUSE_STATUSES).toEqual(['DEPENDENCY_ON_CLIENT', 'DEPENDENCY_ON_VENDOR']);
  });

  it('when the client replies, deadlines move later by the waiting time and the SLA is not breached', () => {
    const paused = { ...t83, status: 'DEPENDENCY_ON_CLIENT', slaStatus: 'PAUSED', slaPausedAt: at('2026-11-18T10:05:00Z') };
    const now = at('2026-11-19T06:05:00Z'); // waited 20 hours — past the original 17:00 deadline
    const data = slaPauseTransition(paused, 'OPEN', now);
    expect(data.slaPausedAt).toBeNull();
    expect(data.resolutionDueAt).toEqual(new Date(t83.resolutionDueAt.getTime() + 20 * H)); // 19 Nov 13:00 UTC
    expect(data.responseDueAt).toBeUndefined(); // already responded: response deadline untouched
    expect(data.slaStatus).toBe('WITHIN_SLA');
    expect(data.slaPausedTotalMins).toEqual({ increment: 1200 });
  });

  it('an unanswered ticket also gets its response deadline extended', () => {
    const paused = { ...t83, respondedAt: null, status: 'DEPENDENCY_ON_VENDOR', slaStatus: 'PAUSED', slaPausedAt: at('2026-11-18T10:05:00Z') };
    const data = slaPauseTransition(paused, 'OPEN', at('2026-11-18T12:05:00Z'));
    expect(data.responseDueAt).toEqual(new Date(t83.responseDueAt.getTime() + 2 * H));
  });

  it('client -> vendor keeps the pause running', () => {
    const paused = { ...t83, status: 'DEPENDENCY_ON_CLIENT', slaStatus: 'PAUSED', slaPausedAt: at('2026-11-18T10:05:00Z') };
    expect(slaPauseTransition(paused, 'DEPENDENCY_ON_VENDOR', at('2026-11-18T11:00:00Z'))).toEqual({});
  });

  it('a breach that happened before the pause stays breached', () => {
    const breached = { ...t83, slaStatus: 'BREACHED' };
    expect(slaPauseTransition(breached, 'DEPENDENCY_ON_CLIENT', at('2026-11-18T18:00:00Z'))).toEqual({ slaPausedAt: at('2026-11-18T18:00:00Z') });
    const resumed = slaPauseTransition({ ...breached, status: 'DEPENDENCY_ON_CLIENT', slaPausedAt: at('2026-11-18T18:00:00Z') }, 'OPEN', at('2026-11-18T19:00:00Z'));
    expect(resumed.slaStatus).toBeUndefined();
  });

  it('resolving while waiting ends the pause cleanly', () => {
    const paused = { ...t83, status: 'DEPENDENCY_ON_CLIENT', slaStatus: 'PAUSED', slaPausedAt: at('2026-11-18T10:05:00Z') };
    const data = slaPauseTransition(paused, 'RESOLVED', at('2026-11-18T12:00:00Z'));
    expect(data.slaPausedAt).toBeNull();
    expect(data.slaStatus).toBe('WITHIN_SLA');
  });

  it('normal changes between active statuses do nothing', () => {
    expect(slaPauseTransition(t83, 'RESOLVED', at('2026-11-18T12:00:00Z'))).toEqual({});
  });
});

describe('the SLA timer and escalation ignore waiting tickets', () => {
  it('breach / warning checks only look at Open and Reopened tickets', () => {
    const now = new Date();
    expect((slaBreachedWhere(now).status as any).in).toEqual(['OPEN', 'REOPENED']);
    expect((slaApproachingWhere(now).status as any).in).toEqual(['OPEN', 'REOPENED']);
  });
});

describe('deptHeadGraceElapsed — team lead gets time before the department head', () => {
  const escalatedToLead = at('2026-11-18T17:05:00Z');
  it(`not after 10 minutes (the 13 Nov / 18 Nov behaviour)`, () => {
    expect(deptHeadGraceElapsed(escalatedToLead, at('2026-11-18T17:15:00Z').getTime())).toBe(false);
  });
  it(`yes after ${DEPT_HEAD_GRACE_MINUTES} minutes`, () => {
    expect(deptHeadGraceElapsed(escalatedToLead, escalatedToLead.getTime() + DEPT_HEAD_GRACE_MINUTES * 60 * 1000)).toBe(true);
  });
  it('no assignment time recorded -> no grace', () => {
    expect(deptHeadGraceElapsed(null)).toBe(true);
  });
});
