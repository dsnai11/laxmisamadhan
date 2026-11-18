import { describe, it, expect } from 'vitest';
import { updateTicketSchema, assignTicketSchema, createTicketSchema, teamIdSchema } from '../validators/ticket.validator';

// Production has a hand-made team id "team-hardware-support"; requiring UUIDs made every
// transfer / assignment naming that team fail with 400 "Validation failed" (18 Nov).
const REAL_TEAM = 'team-hardware-support';
const UUID_TEAM = '35d652c9-66ff-469d-a39b-8be4f6b4d020';

describe('team ids: UUIDs and readable ids are both accepted', () => {
  it('transfer to a team with a readable id', () => {
    const r = updateTicketSchema.safeParse({ departmentId: '40905527-2846-4d3d-a47b-5de9c0192e25', transferTeamId: REAL_TEAM });
    expect(r.success).toBe(true);
  });
  it('assign with a team', () => {
    expect(assignTicketSchema.safeParse({ assignedToId: '120e581f-d099-4576-9378-f22997fed6b8', teamId: REAL_TEAM }).success).toBe(true);
    expect(assignTicketSchema.safeParse({ assignedToId: '120e581f-d099-4576-9378-f22997fed6b8', teamId: UUID_TEAM }).success).toBe(true);
  });
  it('create ticket with a team', () => {
    const shape: any = (createTicketSchema as any).shape || (createTicketSchema as any)._def?.schema?.shape;
    if (shape?.teamId) expect(shape.teamId.safeParse(REAL_TEAM).success).toBe(true);
  });
  it('still rejects junk', () => {
    expect(teamIdSchema.safeParse('').success).toBe(false);
    expect(teamIdSchema.safeParse('team; DROP TABLE').success).toBe(false);
    expect(teamIdSchema.safeParse('x'.repeat(65)).success).toBe(false);
  });
});
