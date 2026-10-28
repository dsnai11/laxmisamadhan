import { prisma } from '@config/prisma';
import { createLogger } from '@utils/logger';
import { logActivity } from '@middleware/audit.middleware';
import emailService from './email.service';
import config from '@config/index';
import { ApprovalStatus, TicketStatus, NotificationType, Prisma } from '@prisma/client';

const logger = createLogger('approval-service');

interface ApprovalData {
  ticketId: string;
  approverId: string;
  title: string;
  description: string;
  expiresAt?: Date;
  level?: number;
  metadata?: Record<string, any>;
}

class ApprovalService {
  async createApproval(data: ApprovalData, requesterId: string): Promise<any> {
    const ticket = await prisma.ticket.findUnique({
      where: { id: data.ticketId },
      include: { raisedBy: true, department: true },
    });

    if (!ticket) throw new Error('Ticket not found');

    const requester = await prisma.user.findUnique({ where: { id: requesterId }, select: { role: true, departmentId: true } });
    const isStaff = !!requester && ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD', 'TEAM_LEAD', 'AGENT'].includes(requester.role);
    const canWorkTicket = !!requester && (['SUPER_ADMIN', 'ADMIN'].includes(requester.role) || ticket.assignedToId === requesterId || requester.departmentId === ticket.departmentId);
    if (!isStaff || !canWorkTicket) throw new Error('Permission denied');

    const approver = await prisma.user.findUnique({ where: { id: data.approverId }, select: { status: true, role: true } });
    if (!approver || approver.status !== 'ACTIVE' || !['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD', 'TEAM_LEAD'].includes(approver.role)) {
      throw new Error('Approver must be an active manager');
    }

    const approval = await prisma.approval.create({
      data: {
        ticketId: data.ticketId,
        requesterId,
        approverId: data.approverId,
        title: data.title,
        description: data.description,
        expiresAt: data.expiresAt,
        level: data.level || 1,
        metadata: data.metadata,
      },
      include: {
        approver: { select: { id: true, firstName: true, lastName: true, email: true } },
        requester: { select: { id: true, firstName: true, lastName: true, email: true } },
        ticket: { select: { id: true, ticketNumber: true, title: true } },
      },
    });

    await prisma.ticket.update({
      where: { id: data.ticketId },
      data: { status: TicketStatus.DEPENDENCY_ON_CLIENT },
    });

    await logActivity(requesterId, 'APPROVAL_REQUESTED', `Requested approval for ticket ${ticket.ticketNumber}`, data.ticketId, { 
      approvalId: approval.id,
      approverId: data.approverId,
    });

    await prisma.notification.create({
      data: {
        userId: data.approverId,
        type: NotificationType.APPROVAL_REQUESTED,
        title: 'Approval requested',
        message: `${approval.requester.firstName} ${approval.requester.lastName} needs your approval on ${ticket.ticketNumber}: ${data.title}`,
        referenceId: ticket.id,
        referenceType: 'TICKET',
      },
    });

    emailService.sendApprovalRequestEmail(
      approval.approver.email,
      ticket.ticketNumber,
      ticket.title,
      `${approval.requester.firstName} ${approval.requester.lastName}`,
      config.frontendUrl
    ).catch(() => undefined);

    return approval;
  }

  async getApprovals(ticketId: string): Promise<any[]> {
    return prisma.approval.findMany({
      where: { ticketId },
      include: {
        approver: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
        requester: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { level: 'asc' },
    });
  }

  async getApprovalById(id: string): Promise<any> {
    const approval = await prisma.approval.findUnique({
      where: { id },
      include: {
        approver: { select: { id: true, firstName: true, lastName: true, email: true } },
        requester: { select: { id: true, firstName: true, lastName: true, email: true } },
        ticket: { include: { department: true, raisedBy: true } },
      },
    });

    if (!approval) throw new Error('Approval not found');
    return approval;
  }

  async getEligibleApprovers(departmentId?: string): Promise<any[]> {
    const approvers = await prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        role: { in: ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD', 'TEAM_LEAD'] },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        departmentId: true,
        department: { select: { id: true, name: true } },
      },
      orderBy: [
        { role: 'asc' },
        { firstName: 'asc' },
      ],
    });
    return approvers;
  }

  async getPendingApprovals(userId: string, params: { page: number; limit: number; all?: boolean }, userRole?: string): Promise<any> {
    const isAdmin = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';
    const where: Prisma.ApprovalWhereInput = {
      ...(isAdmin && params.all ? {} : { approverId: userId }),
      status: ApprovalStatus.PENDING,
      OR: [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ],
    };

    const [approvals, total] = await Promise.all([
      prisma.approval.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        include: {
          ticket: {
            select: { id: true, ticketNumber: true, title: true, priority: true, category: true, department: true },
          },
          requester: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
      prisma.approval.count({ where }),
    ]);

    return { approvals, total, page: params.page, totalPages: Math.ceil(total / params.limit) };
  }

  async respondToApproval(approvalId: string, approverId: string, status: 'APPROVED' | 'REJECTED', response?: string, userRole?: string): Promise<any> {
    const approval = await prisma.approval.findUnique({
      where: { id: approvalId },
      include: { ticket: true, requester: true, approver: true },
    });

    if (!approval) throw new Error('Approval not found');
    const isAdmin = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';
    if (approval.approverId !== approverId && !isAdmin) throw new Error('Not authorized');
    if (approval.status !== ApprovalStatus.PENDING) throw new Error('Approval already processed');
    if (approval.expiresAt && approval.expiresAt < new Date()) throw new Error('Approval expired');

    const updatedApproval = await prisma.approval.update({
      where: { id: approvalId },
      data: {
        status: status === 'APPROVED' ? ApprovalStatus.APPROVED : ApprovalStatus.REJECTED,
        response,
        respondedAt: new Date(),
      },
      include: {
        ticket: { include: { raisedBy: true, department: true } },
        requester: true,
        approver: true,
      },
    });

    await logActivity(approverId, `APPROVAL_${status}`, `${status} approval for ticket ${approval.ticket.ticketNumber}`, approval.ticketId, { 
      approvalId,
      response,
    });

    const ticket = updatedApproval.ticket;
    const decisionText = status === 'APPROVED' ? 'approved' : 'rejected';
    const approverName = `${updatedApproval.approver.firstName} ${updatedApproval.approver.lastName}`;

    if (status === 'APPROVED') {
      const nextApproval = await prisma.approval.findFirst({
        where: { ticketId: approval.ticketId, level: approval.level + 1, status: ApprovalStatus.PENDING },
        orderBy: { level: 'asc' },
        include: { approver: true },
      });

      if (nextApproval) {
        await prisma.notification.create({
          data: {
            userId: nextApproval.approverId,
            type: NotificationType.APPROVAL_REQUESTED,
            title: 'Approval requested',
            message: `${approverName} approved the previous step. Your approval is needed for ${ticket.ticketNumber}: ${nextApproval.title}`,
            referenceId: ticket.id,
            referenceType: 'TICKET',
          },
        });
        emailService.sendApprovalRequestEmail(
          nextApproval.approver.email,
          ticket.ticketNumber,
          ticket.title,
          approverName,
          config.frontendUrl
        ).catch(() => undefined);
      } else {
        await prisma.ticket.update({
          where: { id: approval.ticketId },
          data: { status: TicketStatus.OPEN },
        });
      }
    } else {
      await prisma.ticket.update({
        where: { id: approval.ticketId },
        data: { status: TicketStatus.OPEN },
      });
    }

    const notifyIds = new Set<string>([approval.requesterId, ticket.raisedById]);
    notifyIds.delete(approverId);
    for (const userId of notifyIds) {
      await prisma.notification.create({
        data: {
          userId,
          type: status === 'APPROVED' ? NotificationType.APPROVAL_GRANTED : NotificationType.APPROVAL_DENIED,
          title: status === 'APPROVED' ? 'Approval granted' : 'Approval denied',
          message: `${approverName} ${decisionText} "${approval.title}" on ${ticket.ticketNumber}${response ? `: ${response}` : ''}`,
          referenceId: ticket.id,
          referenceType: 'TICKET',
        },
      });
    }

    const recipientEmails = new Set<string>();
    if (updatedApproval.requester?.email) recipientEmails.add(updatedApproval.requester.email);
    if (ticket.raisedBy?.email) recipientEmails.add(ticket.raisedBy.email);

    for (const email of recipientEmails) {
      emailService.sendApprovalDecisionEmail(
        email,
        ticket.ticketNumber,
        ticket.title,
        status,
        approverName,
        response,
        config.frontendUrl
      ).catch(() => undefined);
    }

    return updatedApproval;
  }

  async cancelApproval(approvalId: string, userId: string, userRole?: string): Promise<void> {
    const approval = await prisma.approval.findUnique({
      where: { id: approvalId },
      include: { ticket: true },
    });

    if (!approval) throw new Error('Approval not found');
    const isAdmin = userRole === 'SUPER_ADMIN' || userRole === 'ADMIN';
    if (!isAdmin && approval.requesterId !== userId && approval.approverId !== userId) {
      throw new Error('Not authorized');
    }
    if (approval.status !== ApprovalStatus.PENDING) throw new Error('Cannot cancel processed approval');

    await prisma.approval.update({
      where: { id: approvalId },
      data: { status: ApprovalStatus.REJECTED, response: 'Cancelled by user', respondedAt: new Date() },
    });

    await prisma.ticket.update({
      where: { id: approval.ticketId },
      data: { status: TicketStatus.OPEN },
    });

    await logActivity(userId, 'APPROVAL_CANCELLED', `Cancelled approval for ticket ${approval.ticket.ticketNumber}`, approval.ticketId, { approvalId });
  }

  async checkExpiredApprovals(): Promise<void> {
    const expired = await prisma.approval.findMany({
      where: {
        status: ApprovalStatus.PENDING,
        expiresAt: { lt: new Date() },
      },
      include: { ticket: true, approver: true, requester: true },
    });

    for (const approval of expired) {
      await prisma.approval.update({
        where: { id: approval.id },
        data: { status: ApprovalStatus.EXPIRED, response: 'Expired', respondedAt: new Date() },
      });

      await prisma.ticket.update({
        where: { id: approval.ticketId },
        data: { status: TicketStatus.OPEN },
      });

      await logActivity('system', 'APPROVAL_EXPIRED', `Approval expired for ticket ${approval.ticket.ticketNumber}`, approval.ticketId, { approvalId: approval.id });
    }
  }
}

export const approvalService = new ApprovalService();
export default approvalService;
