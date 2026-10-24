import { describe, it, expect } from 'vitest';
import { ticketService } from '../services/ticket.service';
import { TicketStatus, TicketPriority, TicketCategory } from '@prisma/client';

describe('Agent Resolved Ticket Count & Multi-Field Search Test Suite', () => {
  it('should construct search clause matching subCategory, subIssue, item, and user relations', () => {
    const where = (ticketService as any).buildTicketWhereClause({
      page: 1,
      limit: 10,
      sortBy: 'createdAt',
      sortOrder: 'desc',
      search: 'Desktop',
    });

    expect(where.AND).toBeDefined();
    const searchClause = where.AND.find((clause: any) => clause.OR && clause.OR.length > 3);
    expect(searchClause).toBeDefined();

    const orFields = searchClause.OR;
    const hasTicketNumber = orFields.some((f: any) => f.ticketNumber);
    const hasTitle = orFields.some((f: any) => f.title);
    const hasSubCategory = orFields.some((f: any) => f.subCategory);
    const hasSubIssue = orFields.some((f: any) => f.subIssue);
    const hasRaisedBy = orFields.some((f: any) => f.raisedBy);
    const hasAssignedTo = orFields.some((f: any) => f.assignedTo);

    expect(hasTicketNumber).toBe(true);
    expect(hasTitle).toBe(true);
    expect(hasSubCategory).toBe(true);
    expect(hasSubIssue).toBe(true);
    expect(hasRaisedBy).toBe(true);
    expect(hasAssignedTo).toBe(true);
  });

  it('should correctly scope queries when assignedToId filter is provided', () => {
    const mockAgentId = 'agent-uuid-12345';
    const where = (ticketService as any).buildTicketWhereClause({
      page: 1,
      limit: 10,
      sortBy: 'createdAt',
      sortOrder: 'desc',
      assignedToId: mockAgentId,
      status: TicketStatus.RESOLVED,
    });

    expect(where.assignedToId).toBe(mockAgentId);
    expect(where.status).toBe(TicketStatus.RESOLVED);
  });
});
