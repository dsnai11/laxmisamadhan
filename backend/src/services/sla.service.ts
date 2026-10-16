import { prisma } from '@config/prisma';
import { createLogger } from '@utils/logger';
import { logActivity } from '@middleware/audit.middleware';
import { TicketPriority, TicketCategory, Prisma } from '@prisma/client';
import { addMinutes, isBefore, isAfter } from 'date-fns';
import { NotFoundError } from '@middleware/error.middleware';

const logger = createLogger('sla-service');

interface SLAPolicyData {
  name: string;
  description?: string;
  departmentId?: string | null;
  category?: TicketCategory | null;
  subCategory?: string | null;
  priority: TicketPriority;
  responseTimeMins: number;
  resolutionTimeMins: number;
  businessHoursOnly?: boolean;
  excludesWeekends?: boolean;
  holidays?: string[];
  escalationRules?: any[];
}

class SLAService {
  async createPolicy(data: SLAPolicyData, createdById: string): Promise<any> {
    const policy = await prisma.sLAPolicy.create({
      data: {
        name: data.name,
        description: data.description,
        departmentId: data.departmentId,
        category: data.category,
        subCategory: data.subCategory,
        priority: data.priority,
        responseTimeMins: data.responseTimeMins,
        resolutionTimeMins: data.resolutionTimeMins,
        businessHoursOnly: data.businessHoursOnly ?? true,
        excludesWeekends: data.excludesWeekends ?? true,
        holidays: data.holidays,
        escalationRules: data.escalationRules,
        createdById,
      },
      include: {
        department: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await logActivity(createdById, 'SLA_POLICY_CREATED', `Created SLA policy ${policy.name}`, undefined, { policyId: policy.id });

    return policy;
  }

  async getPolicies(departmentId?: string): Promise<any[]> {
    return prisma.sLAPolicy.findMany({
      where: departmentId ? { OR: [{ departmentId }, { departmentId: null }] } : {},
      include: {
        department: { select: { id: true, name: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { tickets: true, categoryConfigs: true } },
      },
      orderBy: [{ departmentId: 'desc' }, { priority: 'asc' }],
    });
  }

  async getPolicyById(id: string): Promise<any> {
    const policy = await prisma.sLAPolicy.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, name: true, type: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        categoryConfigs: { include: { department: { select: { id: true, name: true } } } },
        tickets: { select: { id: true, ticketNumber: true, status: true } },
      },
    });

    if (!policy) throw new NotFoundError('SLA policy');

    return policy;
  }

  async updatePolicy(id: string, data: Partial<SLAPolicyData>, updatedById: string): Promise<any> {
    const policy = await prisma.sLAPolicy.findUnique({ where: { id } });
    if (!policy) throw new NotFoundError('SLA policy');

    const updates: Prisma.SLAPolicyUpdateInput = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) updates[key as keyof Prisma.SLAPolicyUpdateInput] = value;
    }

    const updatedPolicy = await prisma.sLAPolicy.update({
      where: { id },
      data: updates,
      include: { department: { select: { id: true, name: true } } },
    });

    await logActivity(updatedById, 'SLA_POLICY_UPDATED', `Updated SLA policy`, undefined, { policyId: id, changes: data });

    return updatedPolicy;
  }

  async deletePolicy(id: string, deletedById: string): Promise<void> {
    const policy = await prisma.sLAPolicy.findUnique({ where: { id } });
    if (!policy) throw new NotFoundError('SLA policy');

    await prisma.$transaction(async (tx) => {
      // 1. Unlink tickets referencing this policy (existing tickets keep their calculated due dates)
      await tx.ticket.updateMany({
        where: { slaPolicyId: id },
        data: { slaPolicyId: null },
      });

      // 2. Unlink any department default SLA policy references
      await tx.department.updateMany({
        where: { slaPolicyId: id },
        data: { slaPolicyId: null },
      });

      // 3. Unlink any category configs referencing this policy
      await tx.ticketCategoryConfig.updateMany({
        where: { slaPolicyId: id },
        data: { slaPolicyId: null },
      });

      // 4. Delete the policy
      await tx.sLAPolicy.delete({ where: { id } });
    });

    await logActivity(deletedById, 'SLA_POLICY_DELETED', `Deleted SLA policy: ${policy.name}`, undefined, { policyId: id, policyName: policy.name });
  }

  async checkSLATimers(): Promise<void> {
    const now = new Date();
    
    const approachingBreach = await prisma.ticket.findMany({
      where: {
        slaStatus: 'WITHIN_SLA',
        OR: [
          { responseDueAt: { lte: addMinutes(now, 30), gt: now } },
          { resolutionDueAt: { lte: addMinutes(now, 60), gt: now } },
        ],
        status: { in: ['OPEN', 'REOPENED', 'DEPENDENCY_ON_CLIENT'] },
      },
      include: { assignedTo: true, raisedBy: true, department: true, slaPolicy: true },
    });

    for (const ticket of approachingBreach) {
      await this.handleApproachingBreach(ticket);
    }

    const breached = await prisma.ticket.findMany({
      where: {
        slaStatus: { in: ['WITHIN_SLA', 'APPROACHING_BREACH'] },
        OR: [
          { responseDueAt: { lt: now } },
          { resolutionDueAt: { lt: now } },
        ],
        status: { in: ['OPEN', 'REOPENED', 'DEPENDENCY_ON_CLIENT'] },
      },
      include: { assignedTo: true, raisedBy: true, department: true, slaPolicy: true },
    });

    for (const ticket of breached) {
      await this.handleBreach(ticket);
    }
  }

  private async handleApproachingBreach(ticket: any): Promise<void> {
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { slaStatus: 'APPROACHING_BREACH' },
    });

    await prisma.sLAEvent.updateMany({
      where: { ticketId: ticket.id, eventType: { contains: 'WARNING' }, acknowledgedAt: null },
      data: { acknowledgedAt: new Date(), acknowledgedById: 'system' },
    });

    const recipients = new Set<string>();
    if (ticket.assignedToId) recipients.add(ticket.assignedToId);
    if (ticket.raisedById) recipients.add(ticket.raisedById);
    if (ticket.department.headId) recipients.add(ticket.department.headId);

    // Notify the team lead of the assigned agent
    if (ticket.assignedToId) {
      const teamLead = await this.getTeamLeadForAgent(ticket.assignedToId, ticket.departmentId);
      if (teamLead) recipients.add(teamLead);
    }

    for (const userId of recipients) {
      await prisma.notification.create({
        data: {
          userId,
          type: 'SLA_WARNING',
          title: 'SLA Breach Approaching',
          message: `Ticket ${ticket.ticketNumber} is approaching SLA breach`,
          referenceId: ticket.id,
          referenceType: 'TICKET',
          metadata: { ticketNumber: ticket.ticketNumber },
        },
      });
    }
  }

  private async handleBreach(ticket: any): Promise<void> {
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { slaStatus: 'BREACHED' },
    });

    await prisma.sLAEvent.create({
      data: {
        ticketId: ticket.id,
        eventType: 'SLA_BREACHED',
        description: `SLA breached for ticket ${ticket.ticketNumber}`,
        triggerTime: new Date(),
      },
    });

    const recipients = new Set<string>();
    if (ticket.assignedToId) recipients.add(ticket.assignedToId);
    if (ticket.raisedById) recipients.add(ticket.raisedById);
    if (ticket.department.headId) recipients.add(ticket.department.headId);

    // Notify the team lead of the assigned agent
    if (ticket.assignedToId) {
      const teamLead = await this.getTeamLeadForAgent(ticket.assignedToId, ticket.departmentId);
      if (teamLead) recipients.add(teamLead);
    }

    for (const userId of recipients) {
      await prisma.notification.create({
        data: {
          userId,
          type: 'SLA_BREACHED',
          title: 'SLA Breached',
          message: `Ticket ${ticket.ticketNumber} has breached its SLA`,
          referenceId: ticket.id,
          referenceType: 'TICKET',
          metadata: { ticketNumber: ticket.ticketNumber },
        },
      });
    }

    if (ticket.slaPolicy?.escalationRules) {
      await this.executeEscalationRules(ticket, ticket.slaPolicy.escalationRules);
    }
  }

  /** Returns the leadId of the team the agent belongs to within the given department */
  private async getTeamLeadForAgent(agentId: string, departmentId: string): Promise<string | null> {
    const team = await prisma.team.findFirst({
      where: {
        departmentId,
        members: { some: { id: agentId } },
        leadId: { not: null },
      },
      select: { leadId: true },
    });
    return team?.leadId ?? null;
  }

  private async executeEscalationRules(ticket: any, rules: any[]): Promise<void> {
    for (const rule of rules) {
      if (rule.action === 'notify' && rule.notifyUserIds) {
        for (const userId of rule.notifyUserIds) {
          await prisma.notification.create({
            data: {
              userId,
              type: 'SLA_BREACHED',
              title: 'SLA Escalation',
              message: `Ticket ${ticket.ticketNumber} has breached SLA and requires attention`,
              referenceId: ticket.id,
              referenceType: 'TICKET',
            },
          });
        }
      } else if (rule.action === 'escalate' && rule.escalateToUserId) {
        await prisma.ticket.update({
          where: { id: ticket.id },
          data: { assignedToId: rule.escalateToUserId, assignedAt: new Date() },
        });
      } else if (rule.action === 'reassign' && rule.reassignToUserId) {
        await prisma.ticket.update({
          where: { id: ticket.id },
          data: { assignedToId: rule.reassignToUserId, assignedAt: new Date() },
        });
      }
    }
  }

  async calculateSLACompliance(departmentId?: string, dateFrom?: Date, dateTo?: Date): Promise<any> {
    const where: Prisma.TicketWhereInput = { status: 'RESOLVED' };
    if (departmentId) where.departmentId = departmentId;
    if (dateFrom || dateTo) {
      where.resolvedAt = {};
      if (dateFrom) where.resolvedAt.gte = dateFrom;
      if (dateTo) where.resolvedAt.lte = dateTo;
    }

    const tickets = await prisma.ticket.findMany({
      where,
      include: { slaPolicy: true },
    });

    let withinSLA = 0;
    let breached = 0;
    let totalResponseTime = 0;
    let totalResolutionTime = 0;
    let respondedCount = 0;
    let resolvedCount = 0;

    for (const ticket of tickets) {
      if (!ticket.slaPolicy) continue;

      const responseTime = ticket.respondedAt ? (ticket.respondedAt.getTime() - ticket.createdAt.getTime()) / 60000 : null;
      const resolutionTime = ticket.resolvedAt ? (ticket.resolvedAt.getTime() - ticket.createdAt.getTime()) / 60000 : null;

      const responseTarget = ticket.slaPolicy.responseTimeMins;
      const resolutionTarget = ticket.slaPolicy.resolutionTimeMins;

      let isWithinSLA = true;
      if (responseTime !== null && responseTime > responseTarget) isWithinSLA = false;
      if (resolutionTime !== null && resolutionTime > resolutionTarget) isWithinSLA = false;

      if (isWithinSLA) withinSLA++;
      else breached++;

      if (responseTime !== null) {
        totalResponseTime += responseTime;
        respondedCount++;
      }
      if (resolutionTime !== null) {
        totalResolutionTime += resolutionTime;
        resolvedCount++;
      }
    }

    return {
      totalTickets: tickets.length,
      withinSLA,
      breached,
      complianceRate: tickets.length > 0 ? (withinSLA / tickets.length) * 100 : 100,
      avgResponseTime: respondedCount > 0 ? totalResponseTime / respondedCount : 0,
      avgResolutionTime: resolvedCount > 0 ? totalResolutionTime / resolvedCount : 0,
      responseTarget: tickets[0]?.slaPolicy?.responseTimeMins || 0,
      resolutionTarget: tickets[0]?.slaPolicy?.resolutionTimeMins || 0,
    };
  }

  async getSLAReport(departmentId?: string, dateFrom?: Date, dateTo?: Date): Promise<any> {
    const compliance = await this.calculateSLACompliance(departmentId, dateFrom, dateTo);
    
    const byPriority = await prisma.ticket.groupBy({
      by: ['priority', 'slaStatus'],
      where: { 
        status: 'RESOLVED',
        ...(departmentId ? { departmentId } : {}),
        ...(dateFrom || dateTo ? { resolvedAt: { gte: dateFrom, lte: dateTo } } : {}),
      },
      _count: true,
    });

    const byCategory = await prisma.ticket.groupBy({
      by: ['category', 'slaStatus'],
      where: { 
        status: 'RESOLVED',
        ...(departmentId ? { departmentId } : {}),
        ...(dateFrom || dateTo ? { resolvedAt: { gte: dateFrom, lte: dateTo } } : {}),
      },
      _count: true,
    });

    return {
      compliance,
      byPriority: byPriority.map(p => ({ priority: p.priority, slaStatus: p.slaStatus, count: p._count })),
      byCategory: byCategory.map(c => ({ category: c.category, slaStatus: c.slaStatus, count: c._count })),
    };
  }
}

export const slaService = new SLAService();
export default slaService;