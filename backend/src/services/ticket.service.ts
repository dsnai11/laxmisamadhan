import { prisma } from '@config/prisma';
import { createLogger } from '@utils/logger';
import { logActivity } from '@middleware/audit.middleware';
import emailService from './email.service';
import config from '@config/index';
import { TicketStatus, TicketPriority, TicketCategory, SLAStatus, Prisma, UserRole, NotificationType, ApprovalStatus } from '@prisma/client';
import { AuthorizationError, NotFoundError } from '@middleware/error.middleware';
import { subMinutes, addMinutes, isBefore, isAfter } from 'date-fns';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const logger = createLogger('ticket-service');

const STAFF_ROLES = ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD', 'TEAM_LEAD', 'AGENT'];
const DEPT_SCOPED_ROLES = ['DEPARTMENT_HEAD', 'TEAM_LEAD', 'AGENT'];
const TICKET_PREFIXES: Record<string, string> = { IT_HARDWARE: 'HW', IT_SOFTWARE: 'SW', DIGITAL_SECURITY: 'SEC', AI: 'AI' };

const fireAndForget = (p: Promise<unknown>) => { p.catch((e) => logger.error('Background task failed', { error: e instanceof Error ? e.message : String(e) })); };

interface CreateTicketData {
  title: string;
  description: string;
  category: TicketCategory;
  subCategory?: string | null;
  subIssue?: string | null;
  item?: string | null;
  group?: string | null;
  site?: string | null;
  teamId?: string | null;
  priority: TicketPriority;
  departmentId: string;
  raisedById: string;
  tags?: string[];
  customFields?: Record<string, any>;
  assetIds?: string[];
  watcherIds?: string[];
  parentTicketId?: string;
  relatedTicketIds?: string[];
}

interface TicketQueryParams {
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
  departmentId?: string;
  assignedToId?: string;
  raisedById?: string;
  teamId?: string;
  tags?: string[];
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  slaStatus?: SLAStatus;
  hasAttachments?: boolean;
  isWatching?: boolean;
  unassigned?: boolean;
  userId?: string;
  userRole?: UserRole;
  userDepartmentId?: string;
}

class TicketService {
  async createTicket(data: CreateTicketData): Promise<any> {
    const department = await prisma.department.findUnique({
      where: { id: data.departmentId },
      include: { slaPolicy: true },
    });

    if (!department) {
      throw new Error('Department not found');
    }

    const ticketNumber = await this.generateTicketNumber(data.departmentId);
    
    const slaPolicy = await this.getApplicableSLAPolicy(
      data.departmentId,
      data.category,
      data.priority,
      data.subCategory,
      data.subIssue || data.item
    );
    const effectivePriority = (slaPolicy?.priority as TicketPriority) || data.priority || TicketPriority.MEDIUM;
    const slaTimes = this.calculateSLATimes(slaPolicy);

    // Resolve team assignment for subCategory within department if configured
    let targetTeamId = data.teamId;
    let targetGroup = data.group;

    if (!targetTeamId && data.subCategory && data.departmentId && data.category) {
      const catConfig = await prisma.ticketCategoryConfig.findFirst({
        where: {
          departmentId: data.departmentId,
          category: data.category,
        },
      });

      const formFields = (catConfig?.formFields as any) || {};
      const subCategoryTeams: Record<string, string> = formFields.subCategoryTeams || {};
      const mappedTeamId = subCategoryTeams[data.subCategory];

      if (mappedTeamId) {
        const team = await prisma.team.findFirst({
          where: { id: mappedTeamId, departmentId: data.departmentId },
        });
        if (team) {
          targetTeamId = team.id;
          targetGroup = team.name;
        }
      }
    }

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        title: data.title,
        description: data.description,
        category: data.category,
        subCategory: data.subCategory || null,
        subIssue: data.subIssue || data.item || null,
        item: data.item || data.subIssue || null,
        group: targetGroup || (data.group || 'Vendor Support-FMS'),
        site: data.site || null,
        teamId: targetTeamId || null,
        priority: effectivePriority,
        departmentId: data.departmentId,
        raisedById: data.raisedById,
        slaPolicyId: slaPolicy?.id,
        responseDueAt: slaTimes.responseDueAt,
        resolutionDueAt: slaTimes.resolutionDueAt,
        tags: data.tags || [],
        customFields: data.customFields,
        assets: data.assetIds ? { connect: data.assetIds.map(id => ({ id })) } : undefined,
        watchers: data.watcherIds ? { create: data.watcherIds.map(userId => ({ userId })) } : undefined,
        parentTicketId: data.parentTicketId,
        relatedTickets: data.relatedTicketIds ? { connect: data.relatedTicketIds.map(id => ({ id })) } : undefined,
      },
      include: {
        raisedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
        department: true,
        slaPolicy: true,
        watchers: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } } },
        assets: true,
      },
    });

    await this.createSLAEvents(ticket.id, slaPolicy);
    await logActivity(data.raisedById, 'TICKET_CREATED', `Created ticket ${ticketNumber}`, ticket.id, { 
      category: data.category, 
      priority: data.priority 
    });

    await this.sendTicketCreatedNotifications(ticket);

    if (department.autoAssign) {
      const assigned = await this.autoAssignTicket(ticket.id, department.assignStrategy || 'round_robin');
      if (assigned) return assigned;
    }

    return ticket;
  }

  async getTickets(params: TicketQueryParams): Promise<{ tickets: any[]; total: number; page: number; totalPages: number }> {
    const where = this.buildTicketWhereClause(params);
    const orderBy = this.buildOrderBy(params.sortBy, params.sortOrder);

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        orderBy,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        include: {
          raisedBy: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, mobile: true, employeeId: true, jobTitle: true, site: true, avatar: true, department: true } },
          assignedTo: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, mobile: true, employeeId: true, jobTitle: true, site: true, avatar: true, role: true, department: true } },
          department: { select: { id: true, name: true, type: true, color: true } },
          team: { select: { id: true, name: true } },
          slaPolicy: { select: { id: true, name: true, responseTimeMins: true, resolutionTimeMins: true } },
          _count: { select: { comments: true, attachments: true, approvals: true } },
        },
      }),
      prisma.ticket.count({ where }),
    ]);

    return {
      tickets,
      total,
      page: params.page,
      totalPages: Math.ceil(total / params.limit),
    };
  }

  private resolveTicketWhere(idOrNumber: string): { id: string } | { ticketNumber: string } {
    const trimmed = (idOrNumber || '').trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
    return isUuid ? { id: trimmed } : { ticketNumber: trimmed.toUpperCase() };
  }

  async getTicketById(id: string, userId: string, userRole: UserRole): Promise<any> {
    const where = this.resolveTicketWhere(id);
    const ticket = await prisma.ticket.findUnique({
      where: where as any,
      include: {
        raisedBy: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, mobile: true, employeeId: true, jobTitle: true, site: true, reportingManagerName: true, avatar: true, department: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, mobile: true, employeeId: true, jobTitle: true, site: true, avatar: true, role: true, department: true } },
        assignedBy: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, mobile: true, role: true, employeeId: true, department: true } },
        department: true,
        team: { include: { lead: { select: { id: true, firstName: true, lastName: true } } } },
        slaPolicy: true,
        parentTicket: { select: { id: true, ticketNumber: true, title: true, status: true } },
        childTickets: { select: { id: true, ticketNumber: true, title: true, status: true } },
        relatedTickets: { select: { id: true, ticketNumber: true, title: true, status: true } },
        watchers: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } } } },
        assets: true,
        updates: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
        comments: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
          include: {
            user: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
            replies: {
              where: { deletedAt: null },
              include: { user: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } } },
            },
          },
        },
        attachments: {
          include: { user: { select: { id: true, firstName: true, lastName: true } } },
        },
        approvals: {
          include: {
            approver: { select: { id: true, firstName: true, lastName: true, email: true } },
            requester: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
        },
        slaEvents: { orderBy: { createdAt: 'desc' } },
        _count: { select: { comments: true, attachments: true, approvals: true } },
      },
    });

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    const userDeptId = await this.getUserDepartmentId(userId);
    if (!this.canAccessTicket(ticket, userId, userRole, userDeptId)) {
      throw new Error('Access denied');
    }

    if (!STAFF_ROLES.includes(userRole)) {
      ticket.comments = ticket.comments
        .filter((c: any) => !c.isInternal)
        .map((c: any) => ({ ...c, replies: (c.replies || []).filter((r: any) => !r.isInternal) }));
    }

    return ticket;
  }

  private async getUserDepartmentId(userId: string): Promise<string | undefined> {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { departmentId: true } });
    return u?.departmentId || undefined;
  }

  async updateTicket(
    id: string,
    data: Partial<CreateTicketData> & { departmentId?: string; transferReason?: string },
    userId: string,
    userRole: UserRole,
    userRoles?: UserRole[]
  ): Promise<any> {
    const ticket = await prisma.ticket.findUnique({
      where: this.resolveTicketWhere(id) as any,
      include: { department: true },
    });

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    const userDeptId = await this.getUserDepartmentId(userId);

    if (!this.canModifyTicket(ticket, userId, userRole, userDeptId, userRoles)) {
      throw new Error('Permission denied');
    }

    const oldValues: Record<string, any> = {};
    const updates: Prisma.TicketUpdateInput = {};

    for (const [key, value] of Object.entries(data)) {
      if (key === 'transferReason' || key === 'departmentId') continue;
      if (value !== undefined && ticket[key as keyof typeof ticket] !== value) {
        oldValues[key] = ticket[key as keyof typeof ticket];
        updates[key as keyof Prisma.TicketUpdateInput] = value;
      }
    }

    const isRaiserOnly = userRole === UserRole.RAISER && (!userRoles || !userRoles.some(r => STAFF_ROLES.includes(r)));
    if (isRaiserOnly) {
      delete updates.priority;
      delete updates.assignedTo;
      delete updates.team;
    }

    // If transferring to a new department (e.g. raised in wrong department):
    if (data.departmentId && data.departmentId !== ticket.departmentId) {
      const allRoles: UserRole[] = Array.from(new Set([
        ...(userRole ? [userRole] : []),
        ...(userRoles || [])
      ]));
      const sameDept = !!userDeptId && userDeptId === ticket.departmentId;
      const canTransfer = allRoles.some(r => ['SUPER_ADMIN', 'ADMIN'].includes(r))
        || (ticket.department?.headId === userId)
        || (allRoles.some(r => ['DEPARTMENT_HEAD', 'TEAM_LEAD'].includes(r)) && sameDept);

      if (!canTransfer) {
        throw new Error('Permission denied: Only Team Leads, Department Heads, and Admins can transfer ticket to another department');
      }

      updates.department = { connect: { id: data.departmentId } };
      // Clear old assignment and team since they belong to the previous department
      updates.assignedTo = { disconnect: true };
      updates.team = { disconnect: true };
      oldValues['departmentId'] = ticket.departmentId;
      oldValues['assignedToId'] = ticket.assignedToId;
      oldValues['teamId'] = ticket.teamId;
    }

    if (Object.keys(updates).length === 0) {
      return ticket;
    }

    if ((updates.priority || updates.category || updates.subCategory || data.departmentId) && !ticket.resolvedAt) {
      const targetDeptId = data.departmentId || ticket.departmentId;
      const newCategory = (updates.category as TicketCategory) || ticket.category;
      const newPriority = (updates.priority as TicketPriority) || ticket.priority;
      const newSubCategory = updates.subCategory !== undefined ? (updates.subCategory as string) : ticket.subCategory;
      const newPolicy = await this.getApplicableSLAPolicy(
        targetDeptId,
        newCategory,
        newPriority,
        newSubCategory,
        (data as any).subIssue || ticket.subIssue || ticket.item
      );
      if (newPolicy && newPolicy.id !== ticket.slaPolicyId) {
        updates.slaPolicy = { connect: { id: newPolicy.id } };
        const newTimes = this.calculateSLATimes(newPolicy);
        if (!ticket.respondedAt && newTimes.responseDueAt) updates.responseDueAt = newTimes.responseDueAt;
        if (newTimes.resolutionDueAt) updates.resolutionDueAt = newTimes.resolutionDueAt;
      }
    }

    const updatedTicket = await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        ...updates,
        updates: {
          create: Object.entries(oldValues).map(([field, oldValue]) => ({
            field,
            oldValue: String(oldValue ?? ''),
            newValue: String((data as any)[field] ?? ''),
            userId,
          })),
        },
      },
      include: {
        raisedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
        department: true,
        slaPolicy: true,
        watchers: true,
      },
    });

    for (const [field, oldValue] of Object.entries(oldValues)) {
      await logActivity(userId, 'TICKET_UPDATED', `Updated ${field}`, id, { 
        field, 
        oldValue, 
        newValue: (data as any)[field] ?? null 
      });
    }

    if (oldValues.departmentId && oldValues.departmentId !== updatedTicket.departmentId) {
      const oldDeptName = ticket.department?.name || 'Previous Department';
      const newDeptName = updatedTicket.department?.name || 'New Department';
      const reasonStr = data.transferReason ? ` (Reason: ${data.transferReason})` : ' (Reassigned: Raised in wrong department)';
      await prisma.comment.create({
        data: {
          ticketId: id,
          userId,
          content: `🔄 Department reassigned from ${oldDeptName} to ${newDeptName}${reasonStr}. Ticket unassigned and queued for ${newDeptName}.`,
          isInternal: true,
        },
      });
    }

    await this.sendTicketUpdatedNotifications(updatedTicket, oldValues);

    return updatedTicket;
  }

  async assignTicket(
    id: string,
    assignedToId: string,
    assignedById: string,
    teamId?: string,
    note?: string,
    actorRole?: UserRole,
    actorRoles?: UserRole[]
  ): Promise<any> {
    const ticket = await prisma.ticket.findUnique({
      where: this.resolveTicketWhere(id) as any,
      include: { department: true, assignedTo: true },
    });

    if (!ticket) {
      throw new NotFoundError('Ticket');
    }

    const effectiveRoles: UserRole[] = Array.from(new Set([
      ...(actorRole ? [actorRole] : []),
      ...(actorRoles || [])
    ]));

    if (effectiveRoles.length > 0) {
      const actorDept = await this.getUserDepartmentId(assignedById);
      const sameDept = !!actorDept && actorDept === ticket.departmentId;

      let isTeamLeadOfTicket = false;
      if (ticket.teamId) {
        const team = await prisma.team.findUnique({
          where: { id: ticket.teamId },
          select: { leadId: true }
        });
        if (team && team.leadId === assignedById) {
          isTeamLeadOfTicket = true;
        }
      }

      const isSuperAdminOrAdmin = effectiveRoles.some(r => ['SUPER_ADMIN', 'ADMIN'].includes(r));
      const isDeptHead = (effectiveRoles.includes('DEPARTMENT_HEAD') && sameDept) || (ticket.department?.headId === assignedById);
      const isTeamLead = (effectiveRoles.includes('TEAM_LEAD') && sameDept) || isTeamLeadOfTicket;
      const canAssignOrReassign = isSuperAdminOrAdmin || isDeptHead || isTeamLead;

      if (!canAssignOrReassign) {
        throw new AuthorizationError('Permission denied: Only Team Leads, Department Heads, and Super Admins can assign or reassign tickets');
      }
    }

    const assignee = await prisma.user.findUnique({
      where: { id: assignedToId },
    });

    if (!assignee) {
      throw new NotFoundError('Assignee');
    }

    const assigneeRoles: UserRole[] = Array.from(new Set([
      assignee.role,
      ...(assignee.roles || [])
    ]));

    if (!assigneeRoles.some(r => STAFF_ROLES.includes(r)) || assignee.status !== 'ACTIVE') {
      throw new Error('Tickets can only be assigned to active staff members');
    }

    const updatedTicket = await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        assignedToId,
        assignedById,
        teamId,
        assignedAt: new Date(),
        respondedAt: ticket.respondedAt ?? new Date(),
        updates: {
          create: {
            field: 'assignedTo',
            oldValue: ticket.assignedTo ? `${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}` : (ticket.assignedToId || 'Unassigned'),
            newValue: `${assignee.firstName} ${assignee.lastName}`,
            userId: assignedById,
          },
        },
      },
      include: {
        raisedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
        assignedBy: { select: { id: true, firstName: true, lastName: true } },
        department: true,
      },
    });

    const isSystemAutoAssign = note === 'Auto-assigned by system';
    const assignerLabel = isSystemAutoAssign
      ? 'System (Auto-assignment)'
      : `${updatedTicket.assignedBy?.firstName ?? 'System'} ${updatedTicket.assignedBy?.lastName ?? ''}`.trim();

    await logActivity(assignedById, 'TICKET_ASSIGNED', isSystemAutoAssign ? `Auto-assigned to ${assignee.firstName} ${assignee.lastName}` : `Assigned to ${assignee.firstName} ${assignee.lastName}`, id, {
      assigneeId: assignedToId,
      note,
      autoAssigned: isSystemAutoAssign,
    });

    if (assignee.email) {
      logger.info(`Sending ticket assigned email to agent: ${assignee.email} for ticket ${ticket.ticketNumber} (assigner: ${assignerLabel})`);
      fireAndForget(emailService.sendTicketAssignedEmail(
        assignee.email,
        ticket.ticketNumber,
        ticket.title,
        assignerLabel,
        config.frontendUrl
      ));
    }

    await this.createNotification({
      userId: assignedToId,
      type: NotificationType.TICKET_ASSIGNED,
      title: 'Ticket Assigned',
      message: `You have been assigned to ticket ${ticket.ticketNumber}: ${ticket.title}`,
      referenceId: id,
      referenceType: 'TICKET',
    });

    return updatedTicket;
  }

  async updateStatus(id: string, status: TicketStatus, userId: string, userRole: UserRole, resolution?: string, resolutionSummary?: string): Promise<any> {
    const ticket = await prisma.ticket.findUnique({
      where: this.resolveTicketWhere(id) as any,
      include: { raisedBy: true, assignedTo: true, department: true },
    });

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    const userDeptId = await this.getUserDepartmentId(userId);
    const sameDept = !!userDeptId && userDeptId === ticket.departmentId;
    const isAdmin = ['SUPER_ADMIN', 'ADMIN'].includes(userRole);
    const isDeptHead = (userRole === 'DEPARTMENT_HEAD' && sameDept) || ticket.department?.headId === userId;
    const isTeamLead = userRole === 'TEAM_LEAD' && sameDept;
    const isAgent = userRole === 'AGENT' && (ticket.assignedToId === userId || sameDept);
    const isAssignee = ticket.assignedToId === userId;

    if (status === TicketStatus.RESOLVED) {
      // Rights to resolve ticket: Agent, Team Lead, Department Head, and Admin
      const canResolve = isAdmin || isDeptHead || isTeamLead || isAgent || isAssignee;
      if (!canResolve) {
        throw new Error('Permission denied: Only Agents, Team Leads, Department Heads, and Admins can resolve tickets. Raisers cannot resolve tickets.');
      }
    } else {
      const raiserAllowed = ticket.raisedById === userId && status === TicketStatus.REOPENED;
      if (!raiserAllowed && !this.canModifyTicket(ticket, userId, userRole, userDeptId)) {
        throw new Error('Permission denied');
      }
    }

    if (status === TicketStatus.RESOLVED && !resolution?.trim()) {
      throw new Error('A resolution note is required to resolve a ticket');
    }

    const validTransitions = this.getValidStatusTransitions(ticket.status);
    if (!['SUPER_ADMIN', 'ADMIN'].includes(userRole) && !validTransitions.includes(status)) {
      throw new Error(`Invalid status transition from ${ticket.status} to ${status}`);
    }

    const updateData: Prisma.TicketUpdateInput = {
      status,
      updates: {
        create: {
          field: 'status',
          oldValue: ticket.status,
          newValue: status,
          userId,
        },
      },
    };

    if (!ticket.respondedAt && status === TicketStatus.OPEN) {
      updateData.respondedAt = new Date();
    }

    if (status === TicketStatus.RESOLVED) {
      updateData.resolvedAt = new Date();
      updateData.resolution = resolution;
      updateData.resolutionSummary = resolutionSummary;
    } else if (status === TicketStatus.REOPENED) {
      updateData.reopenedCount = { increment: 1 };
      updateData.resolvedAt = null;
    }

    const updatedTicket = await prisma.ticket.update({
      where: { id: ticket.id },
      data: updateData,
      include: {
        raisedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
        department: true,
        watchers: true,
      },
    });

    await logActivity(userId, 'STATUS_CHANGED', `Status changed from ${ticket.status} to ${status}`, ticket.id, { 
      oldStatus: ticket.status, 
      newStatus: status,
      resolution,
    });

    await this.sendStatusChangeNotifications(updatedTicket, ticket.status, status, resolution);

    return updatedTicket;
  }

  async addComment(ticketId: string, userId: string, content: string, isInternal: boolean, parentId?: string, mentions?: string[], userRole?: UserRole): Promise<any> {
    const ticket = await prisma.ticket.findUnique({
      where: this.resolveTicketWhere(ticketId) as any,
      include: { raisedBy: true, assignedTo: true, department: true, watchers: { include: { user: true } } },
    });

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    if (userRole) {
      if (!this.canAccessTicket(ticket, userId, userRole, await this.getUserDepartmentId(userId))) {
        throw new Error('Access denied');
      }
      if (!STAFF_ROLES.includes(userRole)) isInternal = false;
    }

    if (!isInternal && !ticket.respondedAt && userId !== ticket.raisedById) {
      await prisma.ticket.update({ where: { id: ticket.id }, data: { respondedAt: new Date() } });
    }

    if (!isInternal && userId === ticket.raisedById && ticket.status === TicketStatus.DEPENDENCY_ON_CLIENT) {
      await this.updateStatus(ticket.id, TicketStatus.OPEN, userId, userRole || UserRole.RAISER);
    }

    const comment = await prisma.comment.create({
      data: {
        ticketId: ticket.id,
        userId,
        content,
        isInternal,
        parentId,
        mentions: mentions || [],
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
        replies: { include: { user: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } } } },
      },
    });

    await logActivity(userId, 'COMMENT_ADDED', isInternal ? 'Added internal note' : 'Added comment', ticket.id, { 
      commentId: comment.id,
      isInternal,
    });

    await this.sendCommentNotifications(comment, ticket, isInternal, mentions);

    return comment;
  }

  async updateComment(ticketId: string, commentId: string, userId: string, content: string, isInternal?: boolean, userRole?: UserRole): Promise<any> {
    const comment = await prisma.comment.findFirst({ where: { id: commentId, ticketId, deletedAt: null } });
    if (!comment) throw new Error('Comment not found');
    if (comment.userId !== userId) throw new Error('Permission denied');

    const canSetInternal = !!userRole && STAFF_ROLES.includes(userRole);
    return prisma.comment.update({
      where: { id: commentId },
      data: { content, ...(canSetInternal && isInternal !== undefined ? { isInternal } : {}) },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } } },
    });
  }

  async deleteComment(ticketId: string, commentId: string, userId: string, userRole?: UserRole): Promise<void> {
    const comment = await prisma.comment.findFirst({ where: { id: commentId, ticketId, deletedAt: null } });
    if (!comment) throw new Error('Comment not found');
    if (comment.userId !== userId && !(userRole && ['SUPER_ADMIN', 'ADMIN'].includes(userRole))) {
      throw new Error('Permission denied');
    }
    await prisma.comment.update({ where: { id: commentId }, data: { deletedAt: new Date() } });
    await logActivity(userId, 'COMMENT_DELETED', 'Deleted a comment', ticketId, { commentId });
  }

  async addAttachment(ticketId: string, userId: string, userRole: UserRole, file: Express.Multer.File): Promise<any> {
    const ticket = await prisma.ticket.findUnique({ where: this.resolveTicketWhere(ticketId) as any, include: { department: true, watchers: true } });
    if (!ticket) throw new Error('Ticket not found');
    if (!this.canAccessTicket(ticket, userId, userRole, await this.getUserDepartmentId(userId))) {
      throw new Error('Access denied');
    }

    const dir = path.resolve(config.upload.dir, 'tickets', ticket.id);
    await fs.promises.mkdir(dir, { recursive: true });
    const ext = path.extname(file.originalname).slice(0, 12).replace(/[^.\w]/g, '');
    const fileName = `${crypto.randomUUID()}${ext}`;
    const fullPath = path.join(dir, fileName);
    await fs.promises.writeFile(fullPath, file.buffer);

    const attachment = await prisma.attachment.create({
      data: {
        ticketId: ticket.id,
        userId,
        fileName,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        path: fullPath,
        checksum: crypto.createHash('sha256').update(file.buffer).digest('hex'),
      },
      include: { user: { select: { id: true, firstName: true, lastName: true } } },
    });

    await logActivity(userId, 'ATTACHMENT_ADDED', `Attached ${file.originalname}`, ticket.id, { attachmentId: attachment.id });
    return attachment;
  }

  async getAttachmentForDownload(ticketId: string, attachmentId: string, userId: string, userRole: UserRole): Promise<any> {
    const ticket = await prisma.ticket.findUnique({ where: this.resolveTicketWhere(ticketId) as any, select: { id: true } });
    const realTicketId = ticket?.id || ticketId;
    const attachment = await prisma.attachment.findFirst({
      where: { id: attachmentId, ticketId: realTicketId },
      include: { ticket: { include: { department: true, watchers: true } } },
    });
    if (!attachment || !attachment.ticket) throw new Error('Attachment not found');
    if (!this.canAccessTicket(attachment.ticket, userId, userRole, await this.getUserDepartmentId(userId))) {
      throw new Error('Access denied');
    }
    return attachment;
  }

  async deleteAttachment(ticketId: string, attachmentId: string, userId: string, userRole: UserRole): Promise<void> {
    const ticket = await prisma.ticket.findUnique({ where: this.resolveTicketWhere(ticketId) as any, select: { id: true } });
    const realTicketId = ticket?.id || ticketId;
    const attachment = await prisma.attachment.findFirst({ where: { id: attachmentId, ticketId: realTicketId } });
    if (!attachment) throw new Error('Attachment not found');
    if (attachment.userId !== userId && !['SUPER_ADMIN', 'ADMIN'].includes(userRole)) {
      throw new Error('Permission denied');
    }
    await prisma.attachment.delete({ where: { id: attachmentId } });
    await fs.promises.unlink(attachment.path).catch(() => undefined);
    await logActivity(userId, 'ATTACHMENT_REMOVED', `Removed ${attachment.originalName}`, realTicketId, { attachmentId });
  }

  async addWatcher(ticketId: string, userId: string, addedById: string): Promise<void> {
    const ticket = await prisma.ticket.findUnique({ where: this.resolveTicketWhere(ticketId) as any });
    if (!ticket) throw new Error('Ticket not found');

    await prisma.ticketWatcher.upsert({
      where: { ticketId_userId: { ticketId: ticket.id, userId } },
      create: { ticketId: ticket.id, userId },
      update: {},
    });

    await logActivity(addedById, 'WATCHER_ADDED', `Added watcher`, ticket.id, { watcherId: userId });
  }

  async removeWatcher(ticketId: string, userId: string, removedById: string): Promise<void> {
    const ticket = await prisma.ticket.findUnique({ where: this.resolveTicketWhere(ticketId) as any });
    if (!ticket) throw new Error('Ticket not found');

    await prisma.ticketWatcher.delete({
      where: { ticketId_userId: { ticketId: ticket.id, userId } },
    });

    await logActivity(removedById, 'WATCHER_REMOVED', `Removed watcher`, ticket.id, { watcherId: userId });
  }

  async bulkAction(ticketIds: string[], action: string, data: Record<string, any>, userId: string, userRole: UserRole, userRoles?: UserRole[]): Promise<{ success: number; failed: number; errors: any[] }> {
    const results = { success: 0, failed: 0, errors: [] as any[] };

    for (const ticketId of ticketIds) {
      try {
        const ticket = await prisma.ticket.findUnique({ where: this.resolveTicketWhere(ticketId) as any });
        if (!ticket) {
          results.failed++;
          results.errors.push({ ticketId, error: 'Ticket not found' });
          continue;
        }

        const bulkDept = await prisma.department.findUnique({ where: { id: ticket.departmentId }, select: { headId: true } });
        if (!this.canModifyTicket({ ...ticket, department: bulkDept }, userId, userRole, await this.getUserDepartmentId(userId))) {
          results.failed++;
          results.errors.push({ ticketId, error: 'Permission denied' });
          continue;
        }

        switch (action) {
          case 'assign':
            await this.assignTicket(ticket.id, data.assignedToId, userId, data.teamId, data.note, userRole, userRoles);
            break;
          case 'status':
            await this.updateStatus(ticket.id, data.status, userId, userRole, data.resolution, data.resolutionSummary);
            break;
          case 'priority':
            await this.updateTicket(ticket.id, { priority: data.priority }, userId, userRole);
            break;
          case 'department':
            await this.updateTicket(ticket.id, { departmentId: data.departmentId }, userId, userRole);
            break;
          case 'tags':
            await this.updateTicket(ticket.id, { tags: data.tags }, userId, userRole);
            break;
          case 'merge':
            if (data.primaryTicketId && ticket.id !== data.primaryTicketId) {
              const primary = await prisma.ticket.findUnique({ where: this.resolveTicketWhere(data.primaryTicketId) as any });
              if (primary) {
                await prisma.comment.create({
                  data: {
                    ticketId: primary.id,
                    userId,
                    content: `📌 [Merged Incident ${ticket.ticketNumber}] Title: "${ticket.title}". Details: ${ticket.description.substring(0, 300)}...`,
                    isInternal: true,
                    isSystem: true,
                  },
                });
                await this.updateStatus(ticket.id, TicketStatus.RESOLVED, userId, userRole, `Merged into ticket #${primary.ticketNumber}`, `Merged into ticket #${primary.ticketNumber}`);
              }
            }
            break;
          case 'link':
            if (data.parentTicketId && ticket.id !== data.parentTicketId) {
              await prisma.ticket.update({
                where: { id: ticket.id },
                data: { parentTicketId: data.parentTicketId },
              });
              await logActivity(userId, 'TICKET_LINKED', `Linked to parent ticket`, ticket.id);
            }
            break;
          case 'delete':
            await this.deleteTicket(ticket.id, userId, userRole);
            break;
        }

        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({ ticketId, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    return results;
  }

  async deleteTicket(id: string, userId: string, userRole: UserRole): Promise<void> {
    const ticket = await prisma.ticket.findUnique({ where: this.resolveTicketWhere(id) as any });
    if (!ticket) throw new Error('Ticket not found');

    if (!['SUPER_ADMIN', 'ADMIN'].includes(userRole) && ticket.raisedById !== userId) {
      throw new Error('Permission denied');
    }

    await prisma.ticket.delete({ where: { id: ticket.id } });
    await logActivity(userId, 'TICKET_DELETED', `Deleted ticket ${ticket.ticketNumber}`, ticket.id);
  }

  async getTicketStats(
    departmentId?: string,
    userId?: string,
    userRole?: UserRole,
    userDepartmentId?: string,
    assignedToId?: string
  ): Promise<any> {
    const where: Prisma.TicketWhereInput = {};

    if (departmentId) where.departmentId = departmentId;
    if (assignedToId) where.assignedToId = assignedToId;
    const visibility = this.buildVisibilityFilter(userId, userRole, userDepartmentId);
    if (visibility) where.AND = [visibility];

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [byStatus, byPriority, byCategory, slaStats, resolvedTodayCount] = await Promise.all([
      prisma.ticket.groupBy({ by: ['status'], where, _count: true }),
      prisma.ticket.groupBy({ by: ['priority'], where, _count: true }),
      prisma.ticket.groupBy({ by: ['category'], where, _count: true }),
      prisma.ticket.groupBy({ by: ['slaStatus'], where, _count: true }),
      prisma.ticket.count({
        where: {
          ...where,
          status: TicketStatus.RESOLVED,
          resolvedAt: { gte: todayStart },
        },
      }),
    ]);

    const statusMap = byStatus.reduce((acc, s) => {
      acc[s.status] = s._count;
      return acc;
    }, {} as Record<string, number>);

    return {
      byStatus: byStatus.map(s => ({ status: s.status, count: s._count })),
      byPriority: byPriority.map(p => ({ priority: p.priority, count: p._count })),
      byCategory: byCategory.map(c => ({ category: c.category, count: c._count })),
      slaStats: slaStats.map(s => ({ status: s.slaStatus, count: s._count })),
      totalTickets: byStatus.reduce((sum, s) => sum + s._count, 0),
      openCount: statusMap[TicketStatus.OPEN] || 0,
      resolvedCount: statusMap[TicketStatus.RESOLVED] || 0,
      reopenedCount: statusMap[TicketStatus.REOPENED] || 0,
      dependencyCount: statusMap[TicketStatus.DEPENDENCY_ON_CLIENT] || 0,
      dependencyVendorCount: statusMap[TicketStatus.DEPENDENCY_ON_VENDOR] || 0,
      resolvedTodayCount,
    };
  }

  private buildTicketWhereClause(params: TicketQueryParams): Prisma.TicketWhereInput {
    const where: Prisma.TicketWhereInput = {};

    if (params.status) where.status = params.status;
    if (params.priority) where.priority = params.priority;
    if (params.category) where.category = params.category;
    if (params.departmentId) where.departmentId = params.departmentId;
    if (params.assignedToId) where.assignedToId = params.assignedToId;
    if (params.unassigned) where.assignedToId = null;
    if (params.raisedById) where.raisedById = params.raisedById;
    if (params.teamId) where.teamId = params.teamId;
    if (params.tags?.length) where.tags = { hasSome: params.tags };
    if (params.hasAttachments !== undefined) where.attachments = params.hasAttachments ? { some: {} } : { none: {} };
    if (params.isWatching && params.userId) where.watchers = { some: { userId: params.userId } };

    const and: Prisma.TicketWhereInput[] = [];

    if (params.slaStatus === 'BREACHED') {
      and.push({
        OR: [
          { slaStatus: 'BREACHED' },
          {
            resolvedAt: null,
            status: { not: TicketStatus.RESOLVED },
            resolutionDueAt: { lt: new Date() },
          },
        ],
      });
    } else if (params.slaStatus) {
      where.slaStatus = params.slaStatus;
    }

    if (params.search) {
      const q = params.search.trim();
      and.push({
        OR: [
          { ticketNumber: { contains: q, mode: 'insensitive' } },
          { title: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { subCategory: { contains: q, mode: 'insensitive' } },
          { subIssue: { contains: q, mode: 'insensitive' } },
          { item: { contains: q, mode: 'insensitive' } },
          {
            raisedBy: {
              OR: [
                { firstName: { contains: q, mode: 'insensitive' } },
                { lastName: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
              ],
            },
          },
          {
            assignedTo: {
              OR: [
                { firstName: { contains: q, mode: 'insensitive' } },
                { lastName: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
              ],
            },
          },
          {
            department: {
              name: { contains: q, mode: 'insensitive' },
            },
          },
        ],
      });
    }

    if (params.dateFrom || params.dateTo) {
      where.createdAt = {};
      if (params.dateFrom) where.createdAt.gte = params.dateFrom;
      if (params.dateTo) where.createdAt.lte = params.dateTo;
    }

    const visibility = this.buildVisibilityFilter(params.userId, params.userRole, params.userDepartmentId);
    if (visibility) and.push(visibility);

    if (and.length) where.AND = and;

    return where;
  }

  private buildVisibilityFilter(userId?: string, userRole?: UserRole, userDepartmentId?: string): Prisma.TicketWhereInput | null {
    if (!userId || !userRole || ['SUPER_ADMIN', 'ADMIN'].includes(userRole)) return null;

    const or: Prisma.TicketWhereInput[] = [
      { raisedById: userId },
      { assignedToId: userId },
      { watchers: { some: { userId } } },
    ];
    if (DEPT_SCOPED_ROLES.includes(userRole) && userDepartmentId) {
      or.push({ departmentId: userDepartmentId });
    }
    return { OR: or };
  }

  private buildOrderBy(sortBy: string, sortOrder: 'asc' | 'desc'): Prisma.TicketOrderByWithRelationInput {
    const validSortFields = ['createdAt', 'updatedAt', 'priority', 'status', 'ticketNumber', 'title'];
    const field = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    return { [field]: sortOrder };
  }

  private canAccessTicket(ticket: any, userId: string, userRole: UserRole, userDeptId?: string): boolean {
    if (['SUPER_ADMIN', 'ADMIN'].includes(userRole)) return true;
    if (ticket.raisedById === userId) return true;
    if (ticket.assignedToId === userId) return true;
    if ((ticket.watchers || []).some((w: any) => w.userId === userId)) return true;
    if ((ticket.approvals || []).some((a: any) => a.approverId === userId)) return true;
    if (ticket.departmentId && ticket.department?.headId === userId) return true;
    if (DEPT_SCOPED_ROLES.includes(userRole) && userDeptId && ticket.departmentId === userDeptId) return true;
    return false;
  }

  private canModifyTicket(ticket: any, userId: string, userRole: UserRole, userDeptId?: string, userRoles?: UserRole[]): boolean {
    const allRoles: UserRole[] = Array.from(new Set([
      ...(userRole ? [userRole] : []),
      ...(userRoles || [])
    ]));
    if (allRoles.some(r => ['SUPER_ADMIN', 'ADMIN'].includes(r))) return true;
    if (ticket.assignedToId === userId) return true;
    if (ticket.raisedById === userId && ['OPEN', 'DEPENDENCY_ON_CLIENT', 'RESOLVED'].includes(ticket.status)) return true;
    if (ticket.department?.headId === userId) return true;
    if (allRoles.some(r => ['DEPARTMENT_HEAD', 'TEAM_LEAD'].includes(r)) && userDeptId && ticket.departmentId === userDeptId) return true;
    return false;
  }

  private getValidStatusTransitions(currentStatus: TicketStatus): TicketStatus[] {
    const transitions: Record<TicketStatus, TicketStatus[]> = {
      [TicketStatus.OPEN]: [TicketStatus.DEPENDENCY_ON_CLIENT, TicketStatus.DEPENDENCY_ON_VENDOR, TicketStatus.RESOLVED],
      [TicketStatus.DEPENDENCY_ON_CLIENT]: [TicketStatus.OPEN, TicketStatus.DEPENDENCY_ON_VENDOR, TicketStatus.RESOLVED],
      [TicketStatus.DEPENDENCY_ON_VENDOR]: [TicketStatus.OPEN, TicketStatus.DEPENDENCY_ON_CLIENT, TicketStatus.RESOLVED],
      [TicketStatus.RESOLVED]: [TicketStatus.REOPENED],
      [TicketStatus.REOPENED]: [TicketStatus.OPEN, TicketStatus.DEPENDENCY_ON_CLIENT, TicketStatus.DEPENDENCY_ON_VENDOR, TicketStatus.RESOLVED],
    };
    return transitions[currentStatus] || [TicketStatus.OPEN, TicketStatus.DEPENDENCY_ON_CLIENT, TicketStatus.DEPENDENCY_ON_VENDOR, TicketStatus.RESOLVED, TicketStatus.REOPENED];
  }

  private async generateTicketNumber(departmentId: string): Promise<string> {
    const department = await prisma.department.findUnique({ where: { id: departmentId } });
    const prefix = (department && TICKET_PREFIXES[department.type]) || 'TKT';
    const year = new Date().getFullYear().toString().slice(-2);
    const count = await prisma.ticket.count({
      where: { departmentId, createdAt: { gte: new Date(new Date().getFullYear(), 0, 1) } },
    });
    let seq = count + 1;
    let ticketNumber = `${prefix}-${year}-${String(seq).padStart(5, '0')}`;
    while (await prisma.ticket.findUnique({ where: { ticketNumber }, select: { id: true } })) {
      seq++;
      ticketNumber = `${prefix}-${year}-${String(seq).padStart(5, '0')}`;
    }
    return ticketNumber;
  }

  private async getApplicableSLAPolicy(
    departmentId: string,
    category: TicketCategory,
    priority?: TicketPriority,
    subCategory?: string | null,
    subIssue?: string | null
  ) {
    const cleanSubCat = subCategory?.trim();
    const cleanSubIssue = subIssue?.trim();

    // 0a. Specific Department + Sub-Issue match with Priority
    if (cleanSubIssue && departmentId) {
      if (priority) {
        const match = await prisma.sLAPolicy.findFirst({
          where: {
            departmentId,
            subCategory: { equals: cleanSubIssue, mode: 'insensitive' },
            priority,
            isActive: true,
          },
        });
        if (match) return match;
      }
      // 0b. Sub-Issue policy defines its own priority
      const matchAnyPriority = await prisma.sLAPolicy.findFirst({
        where: {
          departmentId,
          subCategory: { equals: cleanSubIssue, mode: 'insensitive' },
          isActive: true,
        },
      });
      if (matchAnyPriority) return matchAnyPriority;
    }

    // 0c. Global Sub-Issue match
    if (cleanSubIssue) {
      if (priority) {
        const match = await prisma.sLAPolicy.findFirst({
          where: {
            departmentId: null,
            subCategory: { equals: cleanSubIssue, mode: 'insensitive' },
            priority,
            isActive: true,
          },
        });
        if (match) return match;
      }
      const matchAny = await prisma.sLAPolicy.findFirst({
        where: {
          departmentId: null,
          subCategory: { equals: cleanSubIssue, mode: 'insensitive' },
          isActive: true,
        },
      });
      if (matchAny) return matchAny;
    }

    // 1. Specific Department + Category + Subcategory + Priority
    if (cleanSubCat && departmentId && category) {
      if (priority) {
        const match = await prisma.sLAPolicy.findFirst({
          where: {
            departmentId,
            category,
            subCategory: { equals: cleanSubCat, mode: 'insensitive' },
            priority,
            isActive: true,
          },
        });
        if (match) return match;
      }
      const matchAny = await prisma.sLAPolicy.findFirst({
        where: {
          departmentId,
          category,
          subCategory: { equals: cleanSubCat, mode: 'insensitive' },
          isActive: true,
        },
      });
      if (matchAny) return matchAny;
    }

    // 2. Department + Subcategory + Priority (any category)
    if (cleanSubCat && departmentId) {
      if (priority) {
        const match = await prisma.sLAPolicy.findFirst({
          where: {
            departmentId,
            category: null,
            subCategory: { equals: cleanSubCat, mode: 'insensitive' },
            priority,
            isActive: true,
          },
        });
        if (match) return match;
      }
      const matchAny = await prisma.sLAPolicy.findFirst({
        where: {
          departmentId,
          subCategory: { equals: cleanSubCat, mode: 'insensitive' },
          isActive: true,
        },
      });
      if (matchAny) return matchAny;
    }

    // 3. Global Subcategory + Priority
    if (cleanSubCat) {
      if (priority) {
        const match = await prisma.sLAPolicy.findFirst({
          where: {
            departmentId: null,
            ...(category ? { category } : {}),
            subCategory: { equals: cleanSubCat, mode: 'insensitive' },
            priority,
            isActive: true,
          },
        });
        if (match) return match;
      }
      const matchAny = await prisma.sLAPolicy.findFirst({
        where: {
          departmentId: null,
          subCategory: { equals: cleanSubCat, mode: 'insensitive' },
          isActive: true,
        },
      });
      if (matchAny) return matchAny;
    }

    // 4. Department + Category + Priority (no subcategory constraint)
    if (departmentId && category && priority) {
      const match = await prisma.sLAPolicy.findFirst({
        where: {
          departmentId,
          category,
          subCategory: null,
          priority,
          isActive: true,
        },
      });
      if (match) return match;
    }

    // 5. Category Config default SLA
    const categoryConfig = await prisma.ticketCategoryConfig.findUnique({
      where: { departmentId_category: { departmentId, category } },
      include: { slaPolicy: true },
    });
    if (categoryConfig?.slaPolicy) return categoryConfig.slaPolicy;

    // 6. Department general Priority SLA
    if (priority) {
      const deptPolicy = await prisma.sLAPolicy.findFirst({
        where: {
          departmentId,
          category: null,
          subCategory: null,
          priority,
          isActive: true,
        },
      });
      if (deptPolicy) return deptPolicy;
    }

    // 7. Global Category + Priority (no subcategory constraint)
    if (category && priority) {
      const globalCat = await prisma.sLAPolicy.findFirst({
        where: {
          departmentId: null,
          category,
          subCategory: null,
          priority,
          isActive: true,
        },
      });
      if (globalCat) return globalCat;
    }

    // 8. Global Priority Fallback
    if (priority) {
      return prisma.sLAPolicy.findFirst({
        where: {
          departmentId: null,
          priority,
          isActive: true,
        },
      });
    }

    return null;
  }

  private addBusinessMinutes(startDate: Date, minutesToAdd: number, excludesWeekends = true, holidays: string[] = [], startHour = 9, endHour = 18): Date {
    let current = new Date(startDate);
    let remainingMinutes = minutesToAdd;

    while (remainingMinutes > 0) {
      const dayOfWeek = current.getDay(); // 0 = Sunday, 6 = Saturday
      const dateNum = current.getDate();

      // Sunday is always non-working
      const isSunday = dayOfWeek === 0;

      // 2nd Saturday of the month (date between 8 and 14)
      const isSecondSaturday = dayOfWeek === 6 && dateNum >= 8 && dateNum <= 14;

      // Check if current date is in holiday list (YYYY-MM-DD)
      const dateStr = current.toISOString().slice(0, 10);
      const isCustomHoliday = Array.isArray(holidays) && holidays.includes(dateStr);

      const isNonWorkingDay = isSunday || isSecondSaturday || isCustomHoliday || (excludesWeekends && dayOfWeek === 6);

      if (isNonWorkingDay) {
        current.setDate(current.getDate() + 1);
        current.setHours(startHour, 0, 0, 0);
        continue;
      }

      const currentHour = current.getHours();
      const currentMinute = current.getMinutes();

      if (currentHour < startHour) {
        current.setHours(startHour, 0, 0, 0);
        continue;
      }

      if (currentHour >= endHour) {
        current.setDate(current.getDate() + 1);
        current.setHours(startHour, 0, 0, 0);
        continue;
      }

      const minutesLeftInDay = (endHour - currentHour) * 60 - currentMinute;

      if (remainingMinutes <= minutesLeftInDay) {
        current = addMinutes(current, remainingMinutes);
        remainingMinutes = 0;
      } else {
        remainingMinutes -= minutesLeftInDay;
        current.setDate(current.getDate() + 1);
        current.setHours(startHour, 0, 0, 0);
      }
    }

    return current;
  }

  private calculateSLATimes(slaPolicy: any): { responseDueAt: Date | null; resolutionDueAt: Date | null } {
    if (!slaPolicy) return { responseDueAt: null, resolutionDueAt: null };

    const now = new Date();
    let responseDueAt: Date;
    let resolutionDueAt: Date;
    const holidays = slaPolicy.holidays || [];

    if (slaPolicy.businessHoursOnly || slaPolicy.excludesWeekends) {
      responseDueAt = this.addBusinessMinutes(now, slaPolicy.responseTimeMins, !!slaPolicy.excludesWeekends, holidays);
      resolutionDueAt = this.addBusinessMinutes(now, slaPolicy.resolutionTimeMins, !!slaPolicy.excludesWeekends, holidays);
    } else {
      responseDueAt = addMinutes(now, slaPolicy.responseTimeMins);
      resolutionDueAt = addMinutes(now, slaPolicy.resolutionTimeMins);
    }

    return { responseDueAt, resolutionDueAt };
  }

  private async createSLAEvents(ticketId: string, slaPolicy: any): Promise<void> {
    if (!slaPolicy) return;

    const minute = 60 * 1000;
    const responseMs = slaPolicy.responseTimeMins * minute;
    const resolutionMs = slaPolicy.resolutionTimeMins * minute;
    const events = [
      { eventType: 'RESPONSE_WARNING', delayMs: Math.max(0, responseMs - 30 * minute) },
      { eventType: 'RESPONSE_BREACH', delayMs: responseMs },
      { eventType: 'RESOLUTION_WARNING', delayMs: Math.max(0, resolutionMs - 60 * minute) },
      { eventType: 'RESOLUTION_BREACH', delayMs: resolutionMs },
    ];

    for (const event of events) {
      await prisma.sLAEvent.create({
        data: {
          ticketId,
          eventType: event.eventType,
          description: `SLA ${event.eventType.replace('_', ' ').toLowerCase()}`,
          triggerTime: new Date(Date.now() + event.delayMs),
        },
      });
    }
  }

  private async autoAssignTicket(ticketId: string, strategy: string): Promise<any> {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        department: true,
      },
    });

    if (!ticket || ticket.assignedToId) return null;

    let assignee: any = null;
    let teamId: string | undefined = ticket.teamId || undefined;

    // 0. If ticket is already mapped/assigned to a specific Team (e.g. from sub-category team mapping):
    if (ticket.teamId) {
      const targetTeam = await prisma.team.findUnique({
        where: { id: ticket.teamId },
        include: {
          members: {
            where: {
              status: 'ACTIVE',
              OR: [
                { role: { in: ['AGENT', 'TEAM_LEAD'] } },
                { roles: { hasSome: ['AGENT', 'TEAM_LEAD'] } },
              ],
            },
          },
          lead: true,
        },
      });

      if (targetTeam) {
        teamId = targetTeam.id;
        const members = targetTeam.members;

        if (members.length > 0) {
          if (strategy === 'round_robin') {
            const lastAssignedInTeam = await prisma.ticket.findFirst({
              where: { teamId: targetTeam.id, assignedToId: { not: null } },
              orderBy: { assignedAt: 'desc' },
              select: { assignedToId: true },
            });
            const lastIndex = members.findIndex((m: any) => m.id === lastAssignedInTeam?.assignedToId);
            assignee = members[(lastIndex + 1) % members.length];
          } else if (strategy === 'least_loaded') {
            const loads = await Promise.all(
              members.map(async (m: any) => ({
                agent: m,
                count: await prisma.ticket.count({
                  where: { assignedToId: m.id, status: { in: [TicketStatus.OPEN, TicketStatus.REOPENED, TicketStatus.DEPENDENCY_ON_CLIENT, TicketStatus.DEPENDENCY_ON_VENDOR] } },
                }),
              }))
            );
            assignee = loads.sort((a, b) => a.count - b.count)[0]?.agent;
          }
        }

        // Fallback to Team Lead if active
        if (!assignee && targetTeam.lead && targetTeam.lead.status === 'ACTIVE') {
          assignee = targetTeam.lead;
        }

        if (assignee) {
          logger.info(`Auto-assigning sub-category ticket ${ticket.ticketNumber} to respective team (${targetTeam.name}) member ${assignee.email}`);
          return await this.assignTicket(ticketId, assignee.id, ticket.raisedById, teamId, 'Auto-assigned by system');
        } else {
          logger.warn(`Ticket ${ticket.ticketNumber} is assigned to team ${targetTeam.name} for sub-category ${ticket.subCategory || '-'}, but team has no active agents or lead. Keeping ticket queued in respective team.`);
          return null;
        }
      }
    }

    // 1. Check teams in this department with active agents or team leads
    const teams = await prisma.team.findMany({
      where: { departmentId: ticket.departmentId },
      include: {
        members: {
          where: {
            status: 'ACTIVE',
            OR: [
              { role: { in: ['AGENT', 'TEAM_LEAD'] } },
              { roles: { hasSome: ['AGENT', 'TEAM_LEAD'] } },
            ],
          },
        },
        _count: { select: { tickets: { where: { status: { in: ['OPEN', 'REOPENED', 'DEPENDENCY_ON_CLIENT', 'DEPENDENCY_ON_VENDOR'] } } } } },
      },
    });

    const activeTeams = teams.filter((t) => t.members.length > 0);
    if (activeTeams.length > 0) {
      // Pick team with fewest active tickets
      const sortedTeams = [...activeTeams].sort((a, b) => a._count.tickets - b._count.tickets);
      const targetTeam = sortedTeams[0];
      const members = targetTeam.members;
      teamId = targetTeam.id;

      if (members.length > 0) {
        if (strategy === 'round_robin') {
          const lastAssignedInTeam = await prisma.ticket.findFirst({
            where: { teamId: targetTeam.id, assignedToId: { not: null } },
            orderBy: { assignedAt: 'desc' },
            select: { assignedToId: true },
          });
          const lastIndex = members.findIndex((m: any) => m.id === lastAssignedInTeam?.assignedToId);
          assignee = members[(lastIndex + 1) % members.length];
        } else if (strategy === 'least_loaded') {
          const loads = await Promise.all(
            members.map(async (m: any) => ({
              agent: m,
              count: await prisma.ticket.count({
                where: { assignedToId: m.id, status: { in: [TicketStatus.OPEN, TicketStatus.REOPENED, TicketStatus.DEPENDENCY_ON_CLIENT, TicketStatus.DEPENDENCY_ON_VENDOR] } },
              }),
            }))
          );
          assignee = loads.sort((a, b) => a.count - b.count)[0]?.agent;
        }
      }
    }

    // 2. If no team assignee, check department users who are AGENT or TEAM_LEAD (by role or roles array)
    if (!assignee) {
      const agents = await prisma.user.findMany({
        where: {
          departmentId: ticket.departmentId,
          status: 'ACTIVE',
          OR: [
            { role: { in: ['AGENT', 'TEAM_LEAD'] } },
            { roles: { hasSome: ['AGENT', 'TEAM_LEAD'] } },
          ],
        },
      });

      if (agents.length > 0) {
        if (strategy === 'round_robin') {
          const lastAssigned = await prisma.ticket.findFirst({
            where: { departmentId: ticket.departmentId, assignedToId: { not: null } },
            orderBy: { assignedAt: 'desc' },
            select: { assignedToId: true },
          });
          const lastIndex = agents.findIndex((a: any) => a.id === lastAssigned?.assignedToId);
          assignee = agents[(lastIndex + 1) % agents.length];
        } else if (strategy === 'least_loaded') {
          const loads = await Promise.all(
            agents.map(async (a: any) => ({
              agent: a,
              count: await prisma.ticket.count({
                where: { assignedToId: a.id, status: { in: [TicketStatus.OPEN, TicketStatus.REOPENED, TicketStatus.DEPENDENCY_ON_CLIENT, TicketStatus.DEPENDENCY_ON_VENDOR] } },
              }),
            }))
          );
          assignee = loads.sort((a, b) => a.count - b.count)[0]?.agent;
        }
      }
    }

    // 3. Fallback: If no dedicated AGENT or TEAM_LEAD exists in department, fall back to Department Head / Staff
    if (!assignee) {
      if (ticket.department.headId) {
        const head = await prisma.user.findUnique({
          where: { id: ticket.department.headId },
        });
        if (head && head.status === 'ACTIVE') {
          assignee = head;
        }
      }

      if (!assignee) {
        const staff = await prisma.user.findFirst({
          where: {
            departmentId: ticket.departmentId,
            status: 'ACTIVE',
            OR: [
              { role: { in: ['DEPARTMENT_HEAD', 'ADMIN', 'SUPER_ADMIN'] } },
              { roles: { hasSome: ['DEPARTMENT_HEAD', 'ADMIN', 'SUPER_ADMIN'] } },
            ],
          },
        });
        if (staff) {
          assignee = staff;
        }
      }
    }

    if (assignee) {
      logger.info(`Auto-assigning ticket ${ticket.ticketNumber} to ${assignee.email} (${assignee.id}) using strategy ${strategy}`);
      if (teamId) {
        await prisma.ticket.update({ where: { id: ticketId }, data: { teamId } });
      }
      return await this.assignTicket(ticketId, assignee.id, ticket.raisedById, teamId, 'Auto-assigned by system');
    } else {
      logger.warn(`Auto-assign enabled for department ${ticket.department.name} but no active eligible agent/staff member was found`);
      return null;
    }
  }

  private async sendTicketCreatedNotifications(ticket: any): Promise<void> {
    const watchers = (ticket.watchers || []).map((w: any) => w.user);
    const recipients = [ticket.raisedBy, ...watchers].filter(Boolean);

    for (const user of recipients) {
      await this.createNotification({
        userId: user.id,
        type: NotificationType.TICKET_CREATED,
        title: 'New Ticket Created',
        message: `Ticket ${ticket.ticketNumber}: ${ticket.title} has been created`,
        referenceId: ticket.id,
        referenceType: 'TICKET',
      });
    }

    if (ticket.raisedBy?.email) {
      fireAndForget(emailService.sendTicketCreatedEmail(
        ticket.raisedBy.email,
        ticket.ticketNumber,
        ticket.title,
        config.frontendUrl,
        ticket.department?.name,
        ticket.priority
      ));
    }
  }

  private async sendTicketUpdatedNotifications(ticket: any, oldValues: Record<string, any>): Promise<void> {
    const recipients = new Set<string>();
    if (ticket.raisedById) recipients.add(ticket.raisedById);
    if (ticket.assignedToId) recipients.add(ticket.assignedToId);
    ticket.watchers.forEach((w: any) => recipients.add(w.userId));

    for (const userId of recipients) {
      await this.createNotification({
        userId,
        type: NotificationType.TICKET_UPDATED,
        title: 'Ticket Updated',
        message: `Ticket ${ticket.ticketNumber} has been updated`,
        referenceId: ticket.id,
        referenceType: 'TICKET',
        metadata: { changes: oldValues },
      });
    }
  }

  private async sendStatusChangeNotifications(ticket: any, oldStatus: TicketStatus, newStatus: TicketStatus, resolution?: string): Promise<void> {
    const recipients = new Set<string>();
    if (ticket.raisedById) recipients.add(ticket.raisedById);
    if (ticket.assignedToId) recipients.add(ticket.assignedToId);
    ticket.watchers.forEach((w: any) => recipients.add(w.userId));

    const notificationType = newStatus === TicketStatus.RESOLVED ? NotificationType.TICKET_RESOLVED :
                            newStatus === TicketStatus.REOPENED ? NotificationType.TICKET_REOPENED :
                            NotificationType.TICKET_UPDATED;

    for (const userId of recipients) {
      await this.createNotification({
        userId,
        type: notificationType,
        title: `Ticket ${newStatus}`,
        message: `Ticket ${ticket.ticketNumber} status changed from ${oldStatus} to ${newStatus}${resolution ? `: ${resolution}` : ''}`,
        referenceId: ticket.id,
        referenceType: 'TICKET',
        metadata: { oldStatus, newStatus, resolution },
      });
    }

    if (newStatus === TicketStatus.RESOLVED && ticket.raisedBy?.email) {
      fireAndForget(emailService.sendTicketResolvedEmail(
        ticket.raisedBy.email,
        ticket.ticketNumber,
        ticket.title,
        resolution || 'No resolution provided',
        config.frontendUrl
      ));
    }
  }

  private async sendCommentNotifications(comment: any, ticket: any, isInternal: boolean, mentions?: string[]): Promise<void> {
    const recipients = new Set<string>();
    
    if (!isInternal && ticket.raisedById) recipients.add(ticket.raisedById);
    if (ticket.assignedToId) recipients.add(ticket.assignedToId);
    ticket.watchers.forEach((w: any) => recipients.add(w.userId));
    
    if (mentions) {
      mentions.forEach(id => recipients.add(id));
    }
    
    recipients.delete(comment.userId);

    for (const userId of recipients) {
      await this.createNotification({
        userId,
        type: isInternal ? NotificationType.TICKET_UPDATED : NotificationType.TICKET_COMMENTED,
        title: isInternal ? 'Internal Note Added' : 'New Comment',
        message: `${comment.user.firstName} ${comment.user.lastName} ${isInternal ? 'added an internal note' : 'commented'} on ticket ${ticket.ticketNumber}`,
        referenceId: ticket.id,
        referenceType: 'TICKET',
        metadata: { commentId: comment.id, isInternal },
      });
    }
  }

  private async createNotification(data: { userId: string; type: NotificationType; title: string; message: string; referenceId?: string; referenceType?: string; metadata?: any }): Promise<void> {
    await prisma.notification.create({ data });
  }
}

export const ticketService = new TicketService();
export default ticketService;