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

  async getExecutiveManagementDashboard(params: {
    departmentId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    search?: string;
    tier?: string;
  }): Promise<any> {
    const now = new Date();

    const ticketWhere: Prisma.TicketWhereInput = {};
    if (params.departmentId) {
      ticketWhere.departmentId = params.departmentId;
    }
    if (params.dateFrom || params.dateTo) {
      ticketWhere.createdAt = {};
      if (params.dateFrom) ticketWhere.createdAt.gte = params.dateFrom;
      if (params.dateTo) ticketWhere.createdAt.lte = params.dateTo;
    }

    const agentWhere: Prisma.UserWhereInput = {
      status: 'ACTIVE',
      OR: [
        { role: { in: ['AGENT', 'TEAM_LEAD', 'DEPARTMENT_HEAD'] } },
        { roles: { hasSome: ['AGENT', 'TEAM_LEAD', 'DEPARTMENT_HEAD'] } },
      ],
      ...(params.departmentId ? { departmentId: params.departmentId } : {}),
    };

    const [agents, allTickets, departments, slaPolicies] = await Promise.all([
      prisma.user.findMany({
        where: agentWhere,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          employeeId: true,
          jobTitle: true,
          role: true,
          roles: true,
          avatar: true,
          departmentId: true,
          department: { select: { id: true, name: true, color: true } },
        },
      }),
      prisma.ticket.findMany({
        where: ticketWhere,
        select: {
          id: true,
          ticketNumber: true,
          title: true,
          priority: true,
          status: true,
          slaStatus: true,
          assignedToId: true,
          departmentId: true,
          slaPolicyId: true,
          createdAt: true,
          resolutionDueAt: true,
          responseDueAt: true,
          respondedAt: true,
          resolvedAt: true,
          satisfactionRating: true,
          slaPolicy: { select: { id: true, name: true, resolutionTimeMins: true, responseTimeMins: true, priority: true } },
          department: { select: { id: true, name: true, color: true } },
          raisedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.department.findMany({
        where: params.departmentId ? { id: params.departmentId } : {},
        select: { id: true, name: true, color: true, head: { select: { firstName: true, lastName: true } } },
      }),
      prisma.sLAPolicy.findMany({
        select: { id: true, name: true, priority: true, resolutionTimeMins: true, responseTimeMins: true },
      }),
    ]);

    const ticketsByAgent = new Map<string, typeof allTickets>();
    for (const t of allTickets) {
      if (t.assignedToId) {
        if (!ticketsByAgent.has(t.assignedToId)) {
          ticketsByAgent.set(t.assignedToId, []);
        }
        ticketsByAgent.get(t.assignedToId)!.push(t);
      }
    }

    const agentRows = agents.map(agent => {
      const agentTickets = ticketsByAgent.get(agent.id) || [];
      const assignedCount = agentTickets.length;

      const resolvedTickets = agentTickets.filter(t => t.status === TicketStatus.RESOLVED);
      const openTickets = agentTickets.filter(t => t.status !== TicketStatus.RESOLVED);

      const resolvedCount = resolvedTickets.length;
      const openCount = openTickets.length;
      const resolutionRate = assignedCount > 0 ? Math.round((resolvedCount / assignedCount) * 100) : 0;

      let slaMetCount = 0;
      let slaBreachedCount = 0;

      for (const t of resolvedTickets) {
        const isBreached = t.slaStatus === 'BREACHED' || (t.resolutionDueAt && t.resolvedAt && t.resolvedAt > t.resolutionDueAt);
        if (isBreached) {
          slaBreachedCount++;
        } else {
          slaMetCount++;
        }
      }

      let openBreachedCount = 0;
      for (const t of openTickets) {
        const isOpenBreached = t.slaStatus === 'BREACHED' || (t.resolutionDueAt && now > t.resolutionDueAt);
        if (isOpenBreached) {
          openBreachedCount++;
        }
      }

      const totalEvaluated = slaMetCount + slaBreachedCount;
      const slaComplianceRate = totalEvaluated > 0
        ? Math.round((slaMetCount / totalEvaluated) * 100)
        : (assignedCount === 0 ? 100 : (openBreachedCount > 0 ? 0 : 100));

      let totalResolutionMinutes = 0;
      let resolutionTimeCount = 0;
      for (const t of resolvedTickets) {
        if (t.resolvedAt && t.createdAt) {
          const duration = (t.resolvedAt.getTime() - t.createdAt.getTime()) / 60000;
          if (duration >= 0) {
            totalResolutionMinutes += duration;
            resolutionTimeCount++;
          }
        }
      }
      const avgResolutionTimeMins = resolutionTimeCount > 0
        ? Math.round(totalResolutionMinutes / resolutionTimeCount)
        : 0;

      let totalResponseMinutes = 0;
      let responseTimeCount = 0;
      for (const t of agentTickets) {
        if (t.respondedAt && t.createdAt) {
          const duration = (t.respondedAt.getTime() - t.createdAt.getTime()) / 60000;
          if (duration >= 0) {
            totalResponseMinutes += duration;
            responseTimeCount++;
          }
        }
      }
      const avgResponseTimeMins = responseTimeCount > 0
        ? Math.round(totalResponseMinutes / responseTimeCount)
        : 0;

      const ratedTickets = agentTickets.filter(t => t.satisfactionRating != null && t.satisfactionRating > 0);
      const csatAverage = ratedTickets.length > 0
        ? Number((ratedTickets.reduce((sum, t) => sum + (t.satisfactionRating || 0), 0) / ratedTickets.length).toFixed(1))
        : null;

      let tier: 'TOP_PERFORMER' | 'GOOD' | 'NEEDS_ATTENTION' | 'CRITICAL' = 'GOOD';
      if (assignedCount === 0) {
        tier = 'GOOD';
      } else if (slaComplianceRate >= 90) {
        tier = 'TOP_PERFORMER';
      } else if (slaComplianceRate >= 80) {
        tier = 'GOOD';
      } else if (slaComplianceRate >= 70) {
        tier = 'NEEDS_ATTENTION';
      } else {
        tier = 'CRITICAL';
      }

      const recentTickets = agentTickets.slice(0, 20).map(t => {
        const isBreached = t.slaStatus === 'BREACHED' ||
          (t.resolvedAt && t.resolutionDueAt && t.resolvedAt > t.resolutionDueAt) ||
          (!t.resolvedAt && t.resolutionDueAt && now > t.resolutionDueAt);

        const durationMins = t.resolvedAt && t.createdAt
          ? Math.round((t.resolvedAt.getTime() - t.createdAt.getTime()) / 60000)
          : null;

        return {
          id: t.id,
          ticketNumber: t.ticketNumber,
          title: t.title,
          priority: t.priority,
          status: t.status,
          slaStatus: t.slaStatus,
          isBreached,
          createdAt: t.createdAt,
          resolutionDueAt: t.resolutionDueAt,
          responseDueAt: t.responseDueAt,
          respondedAt: t.respondedAt,
          resolvedAt: t.resolvedAt,
          durationMins,
          slaPolicyName: t.slaPolicy?.name || 'Standard SLA',
          raisedBy: t.raisedBy ? `${t.raisedBy.firstName} ${t.raisedBy.lastName}` : 'Unknown',
          departmentName: t.department?.name || 'General',
        };
      });

      return {
        id: agent.id,
        name: `${agent.firstName} ${agent.lastName}`.trim(),
        email: agent.email,
        employeeId: agent.employeeId || 'N/A',
        jobTitle: agent.jobTitle || agent.role.replace('_', ' '),
        role: agent.role,
        avatar: agent.avatar,
        department: agent.department ? {
          id: agent.department.id,
          name: agent.department.name,
          color: agent.department.color,
        } : null,
        assignedCount,
        resolvedCount,
        openCount,
        resolutionRate,
        slaMetCount,
        slaBreachedCount,
        openBreachedCount,
        slaComplianceRate,
        avgResolutionTimeMins,
        avgResponseTimeMins,
        csatAverage,
        tier,
        recentTickets,
      };
    });

    const departmentBreakdown = departments.map(dept => {
      const deptTickets = allTickets.filter(t => t.departmentId === dept.id);
      const totalTickets = deptTickets.length;
      const resolvedTickets = deptTickets.filter(t => t.status === TicketStatus.RESOLVED);
      const resolvedCount = resolvedTickets.length;
      const openCount = totalTickets - resolvedCount;

      let slaMet = 0;
      let slaBreached = 0;
      let totalResMins = 0;
      let resCount = 0;

      for (const t of resolvedTickets) {
        const isBreached = t.slaStatus === 'BREACHED' || (t.resolutionDueAt && t.resolvedAt && t.resolvedAt > t.resolutionDueAt);
        if (isBreached) {
          slaBreached++;
        } else {
          slaMet++;
        }
        if (t.resolvedAt && t.createdAt) {
          const dur = (t.resolvedAt.getTime() - t.createdAt.getTime()) / 60000;
          if (dur >= 0) {
            totalResMins += dur;
            resCount++;
          }
        }
      }

      const totalEval = slaMet + slaBreached;
      const complianceRate = totalEval > 0 ? Math.round((slaMet / totalEval) * 100) : 100;
      const avgResMins = resCount > 0 ? Math.round(totalResMins / resCount) : 0;
      const deptAgents = agents.filter(a => a.departmentId === dept.id);

      return {
        id: dept.id,
        name: dept.name,
        color: dept.color,
        headName: dept.head ? `${dept.head.firstName} ${dept.head.lastName}` : 'Unassigned',
        agentCount: deptAgents.length,
        totalTickets,
        resolvedCount,
        openCount,
        slaMetCount: slaMet,
        slaBreachedCount: slaBreached,
        slaComplianceRate: complianceRate,
        avgResolutionTimeMins: avgResMins,
      };
    });

    const policyBreakdown = slaPolicies.map(pol => {
      const polTickets = allTickets.filter(t => t.slaPolicyId === pol.id);
      const totalTickets = polTickets.length;
      const resolved = polTickets.filter(t => t.status === TicketStatus.RESOLVED);
      const resolvedCount = resolved.length;

      let slaMet = 0;
      let slaBreached = 0;
      let totalMins = 0;
      let count = 0;

      for (const t of resolved) {
        const isBreached = t.slaStatus === 'BREACHED' || (t.resolutionDueAt && t.resolvedAt && t.resolvedAt > t.resolutionDueAt);
        if (isBreached) slaBreached++;
        else slaMet++;
        if (t.resolvedAt && t.createdAt) {
          const dur = (t.resolvedAt.getTime() - t.createdAt.getTime()) / 60000;
          if (dur >= 0) {
            totalMins += dur;
            count++;
          }
        }
      }

      const totalEval = slaMet + slaBreached;
      const complianceRate = totalEval > 0 ? Math.round((slaMet / totalEval) * 100) : 100;
      const avgMins = count > 0 ? Math.round(totalMins / count) : 0;

      return {
        id: pol.id,
        name: pol.name,
        priority: pol.priority,
        targetResolutionMins: pol.resolutionTimeMins,
        targetResponseMins: pol.responseTimeMins,
        totalTickets,
        resolvedCount,
        slaMetCount: slaMet,
        slaBreachedCount: slaBreached,
        slaComplianceRate: complianceRate,
        avgResolutionTimeMins: avgMins,
      };
    }).filter(p => p.totalTickets > 0 || !params.departmentId);

    const totalAssigned = allTickets.filter(t => t.assignedToId != null).length;
    const totalResolved = allTickets.filter(t => t.status === TicketStatus.RESOLVED).length;
    const totalOpen = allTickets.length - totalResolved;
    const overallResolutionRate = allTickets.length > 0 ? Math.round((totalResolved / allTickets.length) * 100) : 0;

    const resolvedAll = allTickets.filter(t => t.status === TicketStatus.RESOLVED);
    let orgSlaMet = 0;
    let orgSlaBreached = 0;
    let orgResMins = 0;
    let orgResCount = 0;

    for (const t of resolvedAll) {
      const isBreached = t.slaStatus === 'BREACHED' || (t.resolutionDueAt && t.resolvedAt && t.resolvedAt > t.resolutionDueAt);
      if (isBreached) orgSlaBreached++;
      else orgSlaMet++;

      if (t.resolvedAt && t.createdAt) {
        const dur = (t.resolvedAt.getTime() - t.createdAt.getTime()) / 60000;
        if (dur >= 0) {
          orgResMins += dur;
          orgResCount++;
        }
      }
    }

    const orgTotalEval = orgSlaMet + orgSlaBreached;
    const overallSlaComplianceRate = orgTotalEval > 0 ? Math.round((orgSlaMet / orgTotalEval) * 100) : 100;
    const overallAvgResolutionMins = orgResCount > 0 ? Math.round(orgResMins / orgResCount) : 0;

    let orgRespMins = 0;
    let orgRespCount = 0;
    for (const t of allTickets) {
      if (t.respondedAt && t.createdAt) {
        const dur = (t.respondedAt.getTime() - t.createdAt.getTime()) / 60000;
        if (dur >= 0) {
          orgRespMins += dur;
          orgRespCount++;
        }
      }
    }
    const overallAvgResponseMins = orgRespCount > 0 ? Math.round(orgRespMins / orgRespCount) : 0;

    const allRated = allTickets.filter(t => t.satisfactionRating != null && t.satisfactionRating > 0);
    const overallCsat = allRated.length > 0
      ? Number((allRated.reduce((sum, t) => sum + (t.satisfactionRating || 0), 0) / allRated.length).toFixed(1))
      : null;

    let filteredAgents = [...agentRows];
    if (params.search && params.search.trim()) {
      const q = params.search.toLowerCase().trim();
      filteredAgents = filteredAgents.filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        a.employeeId.toLowerCase().includes(q) ||
        (a.department?.name && a.department.name.toLowerCase().includes(q))
      );
    }
    if (params.tier && params.tier !== 'ALL') {
      filteredAgents = filteredAgents.filter(a => a.tier === params.tier);
    }

    filteredAgents.sort((a, b) => {
      if (b.slaComplianceRate !== a.slaComplianceRate) {
        return b.slaComplianceRate - a.slaComplianceRate;
      }
      return b.resolvedCount - a.resolvedCount;
    });

    const topPerformersCount = agentRows.filter(a => a.tier === 'TOP_PERFORMER').length;
    const needsAttentionCount = agentRows.filter(a => a.tier === 'NEEDS_ATTENTION' || a.tier === 'CRITICAL').length;

    return {
      kpis: {
        totalTickets: allTickets.length,
        totalAssigned,
        totalResolved,
        totalOpen,
        overallResolutionRate,
        slaMetCount: orgSlaMet,
        slaBreachedCount: orgSlaBreached,
        slaComplianceRate: overallSlaComplianceRate,
        avgResolutionTimeMins: overallAvgResolutionMins,
        avgResponseTimeMins: overallAvgResponseMins,
        csatAverage: overallCsat,
        totalAgents: agents.length,
        topPerformersCount,
        needsAttentionCount,
      },
      agents: filteredAgents,
      departments: departmentBreakdown,
      slaPolicies: policyBreakdown,
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