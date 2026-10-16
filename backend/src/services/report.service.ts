import { prisma } from '@config/prisma';
import { createLogger } from '@utils/logger';
import { Prisma, TicketStatus, TicketPriority, TicketCategory, UserRole } from '@prisma/client';
import { subDays, startOfDay, endOfDay, format, eachDayOfInterval } from 'date-fns';

const logger = createLogger('report-service');

interface ReportParams {
  departmentId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  userId?: string;
  userRole?: UserRole;
  userDepartmentId?: string;
}

class ReportService {
  async getDashboardStats(params: ReportParams): Promise<any> {
    const where = this.buildTicketWhere(params);
    const userWhere = this.buildUserWhere(params);

    const [
      totalTickets,
      openTickets,
      inProgressTickets,
      resolvedTickets,
      criticalTickets,
      slaBreached,
      avgResolutionTime,
      totalUsers,
      activeUsers,
      ticketsByStatus,
      ticketsByPriority,
      ticketsByCategory,
      ticketsByDepartment,
      recentTickets,
      topAssignees,
    ] = await Promise.all([
      prisma.ticket.count({ where }),
      prisma.ticket.count({ where: { ...where, status: TicketStatus.OPEN } }),
      prisma.ticket.count({ where: { ...where, status: TicketStatus.DEPENDENCY_ON_CLIENT } }),
      prisma.ticket.count({ where: { ...where, status: TicketStatus.RESOLVED } }),
      prisma.ticket.count({ where: { ...where, priority: TicketPriority.CRITICAL } }),
      prisma.ticket.count({ where: { ...where, slaStatus: 'BREACHED' } }),
      this.getAvgResolutionTime(where),
      prisma.user.count({ where: userWhere }),
      prisma.user.count({ where: { ...userWhere, status: 'ACTIVE' } }),
      prisma.ticket.groupBy({ by: ['status'], where, _count: true }),
      prisma.ticket.groupBy({ by: ['priority'], where, _count: true }),
      prisma.ticket.groupBy({ by: ['category'], where, _count: true }),
      prisma.ticket.groupBy({ by: ['departmentId'], where, _count: true }),
      prisma.ticket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, ticketNumber: true, title: true, status: true, priority: true, createdAt: true, raisedBy: { select: { firstName: true, lastName: true } } },
      }),
      this.getTopAssignees(where),
    ]);

    const departmentIds = ticketsByDepartment.map(t => t.departmentId).filter(Boolean) as string[];
    const departments = await prisma.department.findMany({
      where: { id: { in: departmentIds } },
      select: { id: true, name: true, color: true },
    });

    return {
      overview: {
        totalTickets,
        openTickets,
        inProgressTickets,
        resolvedTickets,
        criticalTickets,
        slaBreached,
        avgResolutionTime: Math.round(avgResolutionTime),
        totalUsers,
        activeUsers,
      },
      charts: {
        byStatus: ticketsByStatus.map(t => ({ status: t.status, count: t._count })),
        byPriority: ticketsByPriority.map(t => ({ priority: t.priority, count: t._count })),
        byCategory: ticketsByCategory.map(t => ({ category: t.category, count: t._count })),
        byDepartment: ticketsByDepartment.map(t => ({
          department: departments.find(d => d.id === t.departmentId)?.name || 'Unknown',
          color: departments.find(d => d.id === t.departmentId)?.color || '#3B82F6',
          count: t._count,
        })),
        trend: await this.getTicketTrend(params),
      },
      recentTickets,
      topAssignees,
    };
  }

  async getAgentPerformance(params: ReportParams): Promise<any> {
    const where = this.buildTicketWhere(params);
    
    const agents = await prisma.user.findMany({
      where: { role: { in: ['AGENT', 'TEAM_LEAD'] }, ...(params.departmentId ? { departmentId: params.departmentId } : {}) },
      select: { id: true, firstName: true, lastName: true, email: true, avatar: true },
    });

    const performance = await Promise.all(agents.map(async (agent) => {
      const assignedWhere = { ...where, assignedToId: agent.id };
      const resolvedWhere = { ...assignedWhere, status: TicketStatus.RESOLVED };

      const [assigned, resolved, avgTime, slaCompliance] = await Promise.all([
        prisma.ticket.count({ where: assignedWhere }),
        prisma.ticket.count({ where: resolvedWhere }),
        this.getAvgResolutionTime(assignedWhere),
        this.getSLACompliance(assignedWhere),
      ]);

      return {
        agent,
        assigned,
        resolved,
        resolutionRate: assigned > 0 ? (resolved / assigned) * 100 : 0,
        avgResolutionTime: Math.round(avgTime),
        slaCompliance: Math.round(slaCompliance * 100),
      };
    }));

    return performance.sort((a, b) => b.resolved - a.resolved);
  }

  async getDepartmentReport(params: ReportParams): Promise<any> {
    const departments = await prisma.department.findMany({
      where: params.departmentId ? { id: params.departmentId } : {},
      include: { head: { select: { firstName: true, lastName: true } } },
    });

    return Promise.all(departments.map(async (dept) => {
      const deptParams = { ...params, departmentId: dept.id };
      const where = this.buildTicketWhere(deptParams);

      const [tickets, byStatus, byPriority, byCategory, avgTime, slaCompliance, assets] = await Promise.all([
        prisma.ticket.count({ where }),
        prisma.ticket.groupBy({ by: ['status'], where, _count: true }),
        prisma.ticket.groupBy({ by: ['priority'], where, _count: true }),
        prisma.ticket.groupBy({ by: ['category'], where, _count: true }),
        this.getAvgResolutionTime(where),
        this.getSLACompliance(where),
        prisma.asset.count({ where: { departmentId: dept.id } }),
      ]);

      return {
        department: { ...dept, headName: dept.head ? `${dept.head.firstName} ${dept.head.lastName}` : null },
        totalTickets: tickets,
        byStatus: byStatus.map(s => ({ status: s.status, count: s._count })),
        byPriority: byPriority.map(p => ({ priority: p.priority, count: p._count })),
        byCategory: byCategory.map(c => ({ category: c.category, count: c._count })),
        avgResolutionTime: Math.round(avgTime),
        slaCompliance: Math.round(slaCompliance * 100),
        totalAssets: assets,
      };
    }));
  }

  async getSLAReport(params: ReportParams): Promise<any> {
    const where = this.buildTicketWhere(params);
    const resolvedWhere = { ...where, status: TicketStatus.RESOLVED };

    const [total, withinSLA, breached, byPriority, byCategory, avgResponse, avgResolution] = await Promise.all([
      prisma.ticket.count({ where: resolvedWhere }),
      prisma.ticket.count({ where: { ...resolvedWhere, slaStatus: 'WITHIN_SLA' } }),
      prisma.ticket.count({ where: { ...resolvedWhere, slaStatus: 'BREACHED' } }),
      prisma.ticket.groupBy({ by: ['priority', 'slaStatus'], where: resolvedWhere, _count: true }),
      prisma.ticket.groupBy({ by: ['category', 'slaStatus'], where: resolvedWhere, _count: true }),
      this.getAvgResponseTime(resolvedWhere),
      this.getAvgResolutionTime(resolvedWhere),
    ]);

    return {
      summary: {
        totalResolved: total,
        withinSLA,
        breached,
        complianceRate: total > 0 ? (withinSLA / total) * 100 : 100,
        avgResponseTime: Math.round(avgResponse),
        avgResolutionTime: Math.round(avgResolution),
      },
      byPriority: byPriority.map(p => ({ priority: p.priority, slaStatus: p.slaStatus, count: p._count })),
      byCategory: byCategory.map(c => ({ category: c.category, slaStatus: c.slaStatus, count: c._count })),
      trend: await this.getSLATrend(params),
    };
  }

  async getTicketVolumeTrend(params: ReportParams, days: number = 30): Promise<any> {
    const dateTo = params.dateTo || endOfDay(new Date());
    const dateFrom = params.dateFrom || startOfDay(subDays(dateTo, days));

    const where = {
      ...this.buildTicketWhere(params),
      createdAt: { gte: dateFrom, lte: dateTo },
    };

    const tickets = await prisma.ticket.findMany({
      where,
      select: { createdAt: true, status: true },
    });

    const daysArray = eachDayOfInterval({ start: dateFrom, end: dateTo });
    const trend = daysArray.map(day => {
      const dayStart = startOfDay(day);
      const dayEnd = endOfDay(day);
      const dayTickets = tickets.filter(t => t.createdAt >= dayStart && t.createdAt <= dayEnd);
      return {
        date: format(day, 'yyyy-MM-dd'),
        total: dayTickets.length,
        open: dayTickets.filter(t => t.status !== TicketStatus.RESOLVED).length,
        resolved: dayTickets.filter(t => t.status === TicketStatus.RESOLVED).length,
      };
    });

    return trend;
  }

  async exportTickets(params: ReportParams, fileFormat: 'csv' | 'json' = 'csv'): Promise<string> {
    const where = this.buildTicketWhere(params);
    
    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        raisedBy: { select: { firstName: true, lastName: true, email: true } },
        assignedTo: { select: { firstName: true, lastName: true, email: true } },
        department: { select: { name: true } },
        slaPolicy: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (fileFormat === 'json') {
      return JSON.stringify(tickets, null, 2);
    }

    const cell = (value: unknown): string => {
      let text = String(value ?? '');
      if (/^[=+@\t\r-]/.test(text)) text = `'${text}`;
      return `"${text.replace(/"/g, '""')}"`;
    };

    const headers = [
      'Ticket Number', 'Title', 'Status', 'Priority', 'Category',
      'Department', 'Raised By', 'Assigned To', 'Created At', 'Resolved At',
      'Response Due', 'Resolution Due', 'SLA Status', 'Tags'
    ];

    const rows = tickets.map(t => [
      t.ticketNumber,
      t.title,
      t.status,
      t.priority,
      t.category,
      t.department.name,
      `${t.raisedBy.firstName} ${t.raisedBy.lastName} (${t.raisedBy.email})`,
      t.assignedTo ? `${t.assignedTo.firstName} ${t.assignedTo.lastName}` : '',
      format(t.createdAt, 'yyyy-MM-dd HH:mm'),
      t.resolvedAt ? format(t.resolvedAt, 'yyyy-MM-dd HH:mm') : '',
      t.responseDueAt ? format(t.responseDueAt, 'yyyy-MM-dd HH:mm') : '',
      t.resolutionDueAt ? format(t.resolutionDueAt, 'yyyy-MM-dd HH:mm') : '',
      t.slaStatus,
      t.tags.join('; '),
    ]);

    return [headers.map(cell).join(','), ...rows.map(r => r.map(cell).join(','))].join('\n');
  }

  private buildTicketWhere(params: ReportParams): Prisma.TicketWhereInput {
    const where: Prisma.TicketWhereInput = {};

    if (params.departmentId) where.departmentId = params.departmentId;
    if (params.userId && params.userRole && !['SUPER_ADMIN', 'ADMIN'].includes(params.userRole)) {
      const or: Prisma.TicketWhereInput[] = [
        { raisedById: params.userId },
        { assignedToId: params.userId },
        { watchers: { some: { userId: params.userId } } },
      ];
      if (params.userDepartmentId && ['DEPARTMENT_HEAD', 'TEAM_LEAD', 'AGENT'].includes(params.userRole)) {
        or.push({ departmentId: params.userDepartmentId });
      }
      where.OR = or;
    }

    if (params.dateFrom || params.dateTo) {
      where.createdAt = {};
      if (params.dateFrom) where.createdAt.gte = params.dateFrom;
      if (params.dateTo) where.createdAt.lte = params.dateTo;
    }

    return where;
  }

  private buildUserWhere(params: ReportParams): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = {};
    if (params.departmentId) where.departmentId = params.departmentId;
    return where;
  }

  private async getAvgResolutionTime(where: Prisma.TicketWhereInput): Promise<number> {
    const tickets = await prisma.ticket.findMany({
      where: { ...where, resolvedAt: { not: null } },
      select: { createdAt: true, resolvedAt: true },
    });

    if (tickets.length === 0) return 0;

    const totalMinutes = tickets.reduce((sum, t) => 
      sum + (t.resolvedAt!.getTime() - t.createdAt.getTime()) / 60000, 0);
    return totalMinutes / tickets.length;
  }

  private async getAvgResponseTime(where: Prisma.TicketWhereInput): Promise<number> {
    const tickets = await prisma.ticket.findMany({
      where: { ...where, respondedAt: { not: null } },
      select: { createdAt: true, respondedAt: true },
    });

    if (tickets.length === 0) return 0;

    const totalMinutes = tickets.reduce((sum, t) => 
      sum + (t.respondedAt!.getTime() - t.createdAt.getTime()) / 60000, 0);
    return totalMinutes / tickets.length;
  }

  private async getSLACompliance(where: Prisma.TicketWhereInput): Promise<number> {
    const resolvedWhere = { ...where, status: TicketStatus.RESOLVED };
    const [total, withinSLA] = await Promise.all([
      prisma.ticket.count({ where: resolvedWhere }),
      prisma.ticket.count({ where: { ...resolvedWhere, slaStatus: 'WITHIN_SLA' } }),
    ]);
    return total > 0 ? withinSLA / total : 1;
  }

  private async getTopAssignees(where: Prisma.TicketWhereInput): Promise<any[]> {
    const assignees = await prisma.ticket.groupBy({
      by: ['assignedToId'],
      where: { ...where, assignedToId: { not: null } },
      _count: true,
      orderBy: { _count: { assignedToId: 'desc' } },
      take: 5,
    });

    const userIds = assignees.map(a => a.assignedToId!).filter(Boolean) as string[];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true, email: true, avatar: true },
    });

    return assignees.map(a => ({
      user: users.find(u => u.id === a.assignedToId),
      count: a._count,
    }));
  }

  private async getTicketTrend(params: ReportParams): Promise<any[]> {
    return this.getTicketVolumeTrend(params, 30);
  }

  private async getSLATrend(params: ReportParams): Promise<any[]> {
    const dateTo = params.dateTo || endOfDay(new Date());
    const dateFrom = params.dateFrom || startOfDay(subDays(dateTo, 30));

    const where = {
      ...this.buildTicketWhere(params),
      status: TicketStatus.RESOLVED,
      resolvedAt: { gte: dateFrom, lte: dateTo },
    };

    const tickets = await prisma.ticket.findMany({
      where,
      select: { resolvedAt: true, slaStatus: true },
    });

    const daysArray = eachDayOfInterval({ start: dateFrom, end: dateTo });
    return daysArray.map(day => {
      const dayStart = startOfDay(day);
      const dayEnd = endOfDay(day);
      const dayTickets = tickets.filter(t => t.resolvedAt! >= dayStart && t.resolvedAt! <= dayEnd);
      const total = dayTickets.length;
      const within = dayTickets.filter(t => t.slaStatus === 'WITHIN_SLA').length;
      return {
        date: format(day, 'yyyy-MM-dd'),
        total,
        withinSLA: within,
        breached: total - within,
        complianceRate: total > 0 ? (within / total) * 100 : 100,
      };
    });
  }
}

export const reportService = new ReportService();
export default reportService;