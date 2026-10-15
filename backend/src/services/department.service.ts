import { prisma } from '@config/prisma';
import { createLogger } from '@utils/logger';
import { logActivity } from '@middleware/audit.middleware';
import { TicketCategory, Prisma } from '@prisma/client';

function mapToTicketCategory(categoryStr: string): TicketCategory {
  if (!categoryStr) return TicketCategory.INCIDENT;
  const normalized = categoryStr.toUpperCase().trim().replace(/[\s&/-]+/g, '_');
  if (normalized === 'COMPUTER_HARDWARE') return TicketCategory.HARDWARE_REQUEST;
  if (normalized === 'SOFTWARE_REQUEST' || normalized === 'SOFTWARE') return TicketCategory.SOFTWARE_REQUEST;
  if (normalized === 'NETWORK_ACCESS' || normalized === 'NETWORK') return TicketCategory.ACCESS_REQUEST;
  if (Object.values(TicketCategory).includes(normalized as TicketCategory)) {
    return normalized as TicketCategory;
  }
  return TicketCategory.INCIDENT;
}

const logger = createLogger('department-service');

interface DepartmentData {
  name: string;
  type: string;
  description?: string;
  color?: string;
  icon?: string;
  parentId?: string | null;
  headId?: string | null;
  slaPolicyId?: string | null;
  autoAssign?: boolean;
  assignStrategy?: 'round_robin' | 'least_loaded' | 'skill_based';
  businessHours?: any;
  escalationRules?: any;
  supportEmail?: string | null;
}

interface UpdateDepartmentData extends Partial<DepartmentData> {}

class DepartmentService {
  async createDepartment(data: DepartmentData, createdById: string): Promise<any> {
    const department = await prisma.department.create({
      data: {
        name: data.name,
        type: data.type,
        description: data.description,
        color: data.color || '#3B82F6',
        icon: data.icon,
        parentId: data.parentId,
        headId: data.headId,
        slaPolicyId: data.slaPolicyId,
        autoAssign: data.autoAssign ?? false,
        assignStrategy: data.assignStrategy || 'round_robin',
        businessHours: data.businessHours,
        escalationRules: data.escalationRules,
        supportEmail: data.supportEmail || null,
      },
      include: {
        parent: { select: { id: true, name: true, type: true } },
        head: { select: { id: true, firstName: true, lastName: true, email: true } },
        slaPolicy: { select: { id: true, name: true } },
        children: { select: { id: true, name: true, type: true } },
        _count: { select: { users: true, tickets: true } },
      },
    });

    await this.createDefaultCategoryConfigs(department.id);
    await logActivity(createdById, 'DEPARTMENT_CREATED', `Created department ${department.name}`, undefined, { departmentId: department.id, type: department.type });

    logger.info('Department created', { departmentId: department.id, type: department.type });

    return department;
  }

  async getDepartments(): Promise<any[]> {
    return prisma.department.findMany({
      include: {
        parent: { select: { id: true, name: true, type: true } },
        head: { select: { id: true, firstName: true, lastName: true, email: true } },
        slaPolicy: { select: { id: true, name: true } },
        children: { select: { id: true, name: true, type: true } },
        _count: { select: { users: true, tickets: true, teams: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async getDepartmentById(id: string): Promise<any> {
    const department = await prisma.department.findUnique({
      where: { id },
      include: {
        parent: { select: { id: true, name: true, type: true } },
        head: { select: { id: true, firstName: true, lastName: true, email: true } },
        slaPolicy: { select: { id: true, name: true, responseTimeMins: true, resolutionTimeMins: true } },
        children: { select: { id: true, name: true, type: true } },
        users: {
          select: { id: true, firstName: true, lastName: true, email: true, role: true, status: true },
          where: { status: 'ACTIVE' },
        },
        teams: { include: { lead: { select: { id: true, firstName: true, lastName: true } }, _count: { select: { members: true } } } },
        categories: { include: { slaPolicy: { select: { id: true, name: true } } } },
        knowledgeBases: { select: { id: true, name: true, isPublic: true, _count: { select: { articles: true } } } },
        _count: { select: { users: true, tickets: true, teams: true, assets: true } },
      },
    });

    if (!department) {
      throw new Error('Department not found');
    }

    return department;
  }

  async updateDepartment(
    id: string,
    data: UpdateDepartmentData,
    updatedById: string,
    userRole?: string,
    userDepartmentId?: string | null
  ): Promise<any> {
    const department = await prisma.department.findUnique({ where: { id } });
    if (!department) throw new Error('Department not found');

    if (userRole === 'DEPARTMENT_HEAD') {
      if (userDepartmentId !== id && department.headId !== updatedById) {
        throw new Error('You can only update your own department');
      }
      delete (data as any).parentId;
      delete (data as any).headId;
      delete (data as any).isActive;
    }

    if (data.parentId === id) {
      throw new Error('Department cannot be its own parent');
    }

    if (data.parentId) {
      const descendantIds = await this.getDescendantIds(id);
      if (descendantIds.includes(data.parentId)) {
        throw new Error('Cannot create circular reference');
      }
    }

    // Convert empty strings to null for relations and optional text fields
    if ((data as any).parentId === '') (data as any).parentId = null;
    if ((data as any).headId === '') (data as any).headId = null;
    if ((data as any).slaPolicyId === '') (data as any).slaPolicyId = null;
    if ((data as any).supportEmail === '') (data as any).supportEmail = null;
    if ((data as any).description === '') (data as any).description = null;

    const updates: Record<string, any> = {};
    const oldValues: Record<string, any> = {};

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && (department as any)[key] !== value) {
        oldValues[key] = (department as any)[key];
        updates[key] = value;
      }
    }

    if (Object.keys(updates).length === 0) return department;

    const updatedDepartment = await prisma.department.update({
      where: { id },
      data: updates as Prisma.DepartmentUpdateInput,
      include: {
        parent: { select: { id: true, name: true, type: true } },
        head: { select: { id: true, firstName: true, lastName: true, email: true } },
        slaPolicy: { select: { id: true, name: true } },
        children: { select: { id: true, name: true, type: true } },
      },
    });

    for (const [field, oldValue] of Object.entries(oldValues)) {
      await logActivity(updatedById, 'DEPARTMENT_UPDATED', `Updated ${field}`, undefined, { 
        departmentId: id, 
        field, 
        oldValue, 
        newValue: data[field as keyof UpdateDepartmentData] 
      });
    }

    return updatedDepartment;
  }

  async deleteDepartment(id: string, deletedById: string): Promise<void> {
    const department = await prisma.department.findUnique({
      where: { id },
      include: { _count: { select: { users: true, tickets: true, children: true } } },
    });

    if (!department) throw new Error('Department not found');

    // Find a fallback department (another active department)
    const fallbackDept = await prisma.department.findFirst({
      where: { id: { not: id } },
      select: { id: true },
    });

    // Handle existing tickets in this department
    if (department._count.tickets > 0) {
      if (fallbackDept) {
        await prisma.ticket.updateMany({
          where: { departmentId: id },
          data: { departmentId: fallbackDept.id },
        });
      } else {
        throw new Error(`Cannot delete department "${department.name}" because it contains ${department._count.tickets} active ticket(s) and no other department exists to reassign them to.`);
      }
    }

    // Unlink child departments
    await prisma.department.updateMany({
      where: { parentId: id },
      data: { parentId: null },
    });

    // Unassign users and clean up category configs / teams / SLA policies / assets / KB
    await prisma.user.updateMany({ where: { departmentId: id }, data: { departmentId: null } });
    await prisma.team.deleteMany({ where: { departmentId: id } });
    await prisma.ticketCategoryConfig.deleteMany({ where: { departmentId: id } });
    await prisma.customField.updateMany({ where: { departmentId: id }, data: { departmentId: null } });
    await prisma.sLAPolicy.updateMany({ where: { departmentId: id }, data: { departmentId: null } });
    await prisma.knowledgeBase.deleteMany({ where: { departmentId: id } });

    if (fallbackDept) {
      await prisma.asset.updateMany({ where: { departmentId: id }, data: { departmentId: fallbackDept.id } });
    } else {
      await prisma.asset.deleteMany({ where: { departmentId: id } });
    }

    await prisma.department.delete({ where: { id } });
    await logActivity(deletedById, 'DEPARTMENT_DELETED', `Deleted department ${department.name}`, undefined, { departmentId: id, name: department.name });
  }

  async getDepartmentTree(): Promise<any[]> {
    const departments = await prisma.department.findMany({
      where: { parentId: null },
      include: {
        children: {
          include: {
            children: { include: { children: true } },
          },
        },
        head: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { users: true, tickets: true } },
      },
    });

    return departments;
  }

  async assignHead(departmentId: string, headId: string | null, updatedById: string): Promise<any> {
    if (headId) {
      const user = await prisma.user.findUnique({ where: { id: headId } });
      if (!user) throw new Error('User not found');
      if (user.departmentId !== departmentId) throw new Error('User must belong to this department');
    }

    const department = await prisma.department.update({
      where: { id: departmentId },
      data: { headId },
      include: { head: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });

    await logActivity(updatedById, 'DEPARTMENT_HEAD_CHANGED', `Department head ${headId ? 'assigned' : 'removed'}`, undefined, { departmentId, headId });

    return department;
  }

  async getDepartmentStats(departmentId: string): Promise<any> {
    const department = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!department) throw new Error('Department not found');

    const [ticketStats, userStats, slaStats, teamStats, assetStats] = await Promise.all([
      prisma.ticket.groupBy({ by: ['status'], where: { departmentId }, _count: true }),
      prisma.user.groupBy({ by: ['role'], where: { departmentId, status: 'ACTIVE' }, _count: true }),
      prisma.sLAEvent.groupBy({ by: ['eventType'], where: { ticket: { departmentId } }, _count: true }),
      prisma.team.findMany({ where: { departmentId }, include: { _count: { select: { members: true, tickets: true } } } }),
      prisma.asset.groupBy({ by: ['status'], where: { departmentId }, _count: true }),
    ]);

    return {
      tickets: {
        total: ticketStats.reduce((sum, s) => sum + s._count, 0),
        byStatus: ticketStats.map(s => ({ status: s.status, count: s._count })),
      },
      users: {
        total: userStats.reduce((sum, s) => sum + s._count, 0),
        byRole: userStats.map(s => ({ role: s.role, count: s._count })),
      },
      sla: {
        events: slaStats.map(s => ({ type: s.eventType, count: s._count })),
      },
      teams: teamStats.map(t => ({
        id: t.id,
        name: t.name,
        members: t._count.members,
        tickets: t._count.tickets,
      })),
      assets: assetStats.map(a => ({ status: a.status, count: a._count })),
    };
  }

  async createCategoryConfig(departmentId: string, rawCategory: string, data: { isActive?: boolean; defaultPriority?: string; slaPolicyId?: string | null; formFields?: any; approvalFlow?: any }): Promise<any> {
    const department = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!department) throw new Error('Department not found');

    const categoryEnum = mapToTicketCategory(rawCategory);

    return prisma.ticketCategoryConfig.upsert({
      where: { departmentId_category: { departmentId, category: categoryEnum } },
      create: {
        departmentId,
        category: categoryEnum,
        isActive: data.isActive ?? true,
        defaultPriority: (data.defaultPriority as any) || 'MEDIUM',
        slaPolicyId: data.slaPolicyId,
        formFields: data.formFields,
        approvalFlow: data.approvalFlow,
      },
      update: {
        isActive: data.isActive ?? true,
        defaultPriority: (data.defaultPriority as any) || 'MEDIUM',
        slaPolicyId: data.slaPolicyId,
        formFields: data.formFields,
        approvalFlow: data.approvalFlow,
      },
      include: { slaPolicy: { select: { id: true, name: true } } },
    });
  }

  async updateCategoryConfig(departmentId: string, rawCategory: string, data: Partial<{ isActive: boolean; defaultPriority: string; slaPolicyId: string | null; formFields: any; approvalFlow: any }>): Promise<any> {
    const categoryEnum = mapToTicketCategory(rawCategory);

    return prisma.ticketCategoryConfig.upsert({
      where: { departmentId_category: { departmentId, category: categoryEnum } },
      create: {
        departmentId,
        category: categoryEnum,
        isActive: data.isActive ?? true,
        defaultPriority: (data.defaultPriority as any) || 'MEDIUM',
        slaPolicyId: data.slaPolicyId,
        formFields: data.formFields,
        approvalFlow: data.approvalFlow,
      },
      update: data as any,
      include: { slaPolicy: { select: { id: true, name: true } } },
    });
  }

  async deleteCategoryConfig(departmentId: string, rawCategory: string): Promise<any> {
    const categoryEnum = mapToTicketCategory(rawCategory);
    return prisma.ticketCategoryConfig.deleteMany({
      where: {
        departmentId,
        category: categoryEnum,
      },
    });
  }

  async getCategoryConfigs(departmentId: string): Promise<any[]> {
    return prisma.ticketCategoryConfig.findMany({
      where: { departmentId },
      include: { slaPolicy: { select: { id: true, name: true } } },
      orderBy: { category: 'asc' },
    });
  }

  private async createDefaultCategoryConfigs(departmentId: string): Promise<void> {
    const ticketCategories = ['INCIDENT', 'SERVICE_REQUEST', 'CHANGE_REQUEST', 'PROBLEM', 'ACCESS_REQUEST', 'HARDWARE_REQUEST', 'SOFTWARE_REQUEST', 'SECURITY_INCIDENT', 'AI_MODEL_REQUEST', 'DATA_REQUEST'];

    for (const category of ticketCategories) {
      await prisma.ticketCategoryConfig.create({
        data: {
          departmentId,
          category: category as any,
          isActive: true,
          defaultPriority: 'MEDIUM',
        },
      }).catch(() => {}); // Ignore duplicates
    }
  }

  private async getDescendantIds(departmentId: string): Promise<string[]> {
    const children = await prisma.department.findMany({ where: { parentId: departmentId }, select: { id: true } });
    const ids = children.map(c => c.id);
    
    for (const child of children) {
      ids.push(...await this.getDescendantIds(child.id));
    }
    
    return ids;
  }

  private teamInclude = {
    lead: { select: { id: true, firstName: true, lastName: true, email: true } },
    members: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
    _count: { select: { members: true, tickets: true } },
  };

  async getTeams(departmentId: string): Promise<any[]> {
    return prisma.team.findMany({
      where: { departmentId },
      include: this.teamInclude,
      orderBy: { name: 'asc' },
    });
  }

  async createTeam(
    departmentId: string,
    data: { name: string; description?: string; leadId?: string; memberIds?: string[]; supportEmail?: string },
    userId: string,
    userRole?: string,
    userDepartmentId?: string | null
  ): Promise<any> {
    const department = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!department) throw new Error('Department not found');

    if (userRole === 'DEPARTMENT_HEAD') {
      if (userDepartmentId !== departmentId && department.headId !== userId) {
        throw new Error('You can only create teams in your own department');
      }
    } else if (userRole === 'TEAM_LEAD') {
      if (userDepartmentId !== departmentId) {
        throw new Error('You can only create teams in your own department');
      }
      if (!data.leadId) {
        data.leadId = userId;
      }
    }

    if (data.memberIds && data.memberIds.length > 0 && (userRole === 'DEPARTMENT_HEAD' || userRole === 'TEAM_LEAD')) {
      const foreignUsers = await prisma.user.findMany({
        where: {
          id: { in: data.memberIds },
          departmentId: { not: departmentId }
        },
        select: { id: true }
      });
      if (foreignUsers.length > 0) {
        throw new Error('Team members must belong to this department');
      }
    }

    const team = await prisma.team.create({
      data: {
        name: data.name,
        description: data.description,
        supportEmail: data.supportEmail || null,
        departmentId,
        leadId: data.leadId || null,
        members: data.memberIds?.length ? { connect: data.memberIds.map(id => ({ id })) } : undefined,
      },
      include: this.teamInclude,
    });

    await logActivity(userId, 'TEAM_CREATED', `Created team ${team.name}`, undefined, { teamId: team.id, departmentId });
    return team;
  }

  async updateTeam(
    teamId: string,
    data: { name?: string; description?: string; leadId?: string; memberIds?: string[]; supportEmail?: string },
    userId: string,
    userRole?: string,
    userDepartmentId?: string | null
  ): Promise<any> {
    const existing = await prisma.team.findUnique({ where: { id: teamId } });
    if (!existing) throw new Error('Team not found');

    if (userRole === 'DEPARTMENT_HEAD') {
      if (existing.departmentId !== userDepartmentId) {
        const dept = await prisma.department.findUnique({ where: { id: existing.departmentId } });
        if (dept?.headId !== userId) {
          throw new Error('You can only manage teams in your department');
        }
      }
    } else if (userRole === 'TEAM_LEAD') {
      // TEAM_LEAD can only update their own team
      if (existing.leadId !== userId) {
        throw new Error('You can only manage your own team');
      }
      // Lead cannot reassign the team lead away
      if (data.leadId && data.leadId !== userId) {
        delete data.leadId;
      }
    }

    if (data.memberIds && data.memberIds.length > 0 && (userRole === 'DEPARTMENT_HEAD' || userRole === 'TEAM_LEAD')) {
      const foreignUsers = await prisma.user.findMany({
        where: {
          id: { in: data.memberIds },
          departmentId: { not: existing.departmentId }
        },
        select: { id: true }
      });
      if (foreignUsers.length > 0) {
        throw new Error('Team members must belong to this department');
      }
    }

    const team = await prisma.team.update({
      where: { id: teamId },
      data: {
        name: data.name,
        description: data.description,
        supportEmail: data.supportEmail !== undefined ? (data.supportEmail || null) : undefined,
        leadId: data.leadId !== undefined ? (data.leadId || null) : undefined,
        members: data.memberIds ? { set: data.memberIds.map(id => ({ id })) } : undefined,
      },
      include: this.teamInclude,
    });

    await logActivity(userId, 'TEAM_UPDATED', `Updated team ${team.name}`, undefined, { teamId });
    return team;
  }

  async deleteTeam(
    teamId: string,
    userId: string,
    userRole?: string,
    userDepartmentId?: string | null
  ): Promise<void> {
    const existing = await prisma.team.findUnique({ where: { id: teamId }, include: { _count: { select: { tickets: true } } } });
    if (!existing) throw new Error('Team not found');
    if (existing._count.tickets > 0) throw new Error('A team with tickets cannot be deleted');

    if (userRole === 'DEPARTMENT_HEAD') {
      if (existing.departmentId !== userDepartmentId) {
        const dept = await prisma.department.findUnique({ where: { id: existing.departmentId } });
        if (dept?.headId !== userId) {
          throw new Error('You can only delete teams in your department');
        }
      }
    }

    await prisma.team.delete({ where: { id: teamId } });
    await logActivity(userId, 'TEAM_DELETED', `Deleted team ${existing.name}`, undefined, { teamId });
  }

  async getTeamBucket(
    teamId: string,
    params: { page?: number; limit?: number; status?: string; assignedToId?: string; priority?: string },
    requestingUserId: string,
    requestingUserRole: string,
  ): Promise<any> {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { members: { select: { id: true } } },
    });
    if (!team) throw new Error('Team not found');

    // TEAM_LEAD can only view their own team's bucket
    if (requestingUserRole === 'TEAM_LEAD' && team.leadId !== requestingUserId) {
      throw new Error('Access denied: you can only view your own team bucket');
    }

    const memberIds = team.members.map((m: any) => m.id);
    const page = params.page || 1;
    const limit = params.limit || 20;

    const where: any = { assignedToId: { in: memberIds } };
    if (params.status) where.status = params.status;
    if (params.assignedToId) where.assignedToId = params.assignedToId;
    if (params.priority) where.priority = params.priority;

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          raisedBy: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
          assignedTo: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
          department: { select: { id: true, name: true, type: true, color: true } },
          slaPolicy: { select: { id: true, name: true, responseTimeMins: true, resolutionTimeMins: true } },
          _count: { select: { comments: true, attachments: true } },
        },
      }),
      prisma.ticket.count({ where }),
    ]);

    return {
      tickets,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      team: {
        id: team.id,
        name: (team as any).name,
        memberIds,
      },
    };
  }
}

export const departmentService = new DepartmentService();
export default departmentService;