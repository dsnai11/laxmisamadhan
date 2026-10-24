import { config } from '@config/index';
import { prisma } from '@config/prisma';
import logger from '@utils/logger';
import { logActivity } from '@middleware/audit.middleware';
import emailService from './email.service';
import wsService from './websocket.service';
import { TicketCategory, TicketPriority, TicketStatus } from '@prisma/client';

export interface InboundEmailPayload {
  fromEmail: string;
  fromName?: string;
  toEmail: string;
  subject: string;
  body: string;
  attachments?: { fileName: string; mimeType: string; content?: string }[];
}

class InboundEmailService {
  /**
   * Helper to generate unique ticket number based on department type and year
   */
  private async generateTicketNumber(departmentId?: string): Promise<string> {
    let prefix = 'TKT';
    if (departmentId) {
      const dept = await prisma.department.findUnique({ where: { id: departmentId } });
      if (dept) {
        if (dept.name.toLowerCase().includes('hardware')) prefix = 'HW';
        else if (dept.name.toLowerCase().includes('software') || dept.name.toLowerCase().includes('application')) prefix = 'SW';
        else if (dept.type === 'IT') prefix = 'IT';
      }
    }
    const year = new Date().getFullYear().toString().slice(-2);
    const count = await prisma.ticket.count();
    let seq = count + 1;
    let ticketNumber = `${prefix}-${year}-${String(seq).padStart(5, '0')}`;
    while (await prisma.ticket.findUnique({ where: { ticketNumber }, select: { id: true } })) {
      seq++;
      ticketNumber = `${prefix}-${year}-${String(seq).padStart(5, '0')}`;
    }
    return ticketNumber;
  }

  /**
   * Process an incoming email and either create a new ticket or append a reply comment
   */
  async processInboundEmail(payload: InboundEmailPayload): Promise<{ action: 'TICKET_CREATED' | 'COMMENT_ADDED'; ticket: any }> {
    const fromEmail = payload.fromEmail.toLowerCase().trim();
    const toEmail = payload.toEmail.toLowerCase().trim();
    const subject = payload.subject.trim();
    const body = payload.body.trim();

    logger.info('Processing inbound email', { fromEmail, toEmail, subject });

    // 1. Check if sender exists as a User, or auto-create a RAISER user account
    let raiser = await prisma.user.findUnique({ where: { email: fromEmail } });
    if (!raiser) {
      const nameParts = (payload.fromName || fromEmail.split('@')[0]).split(' ');
      const firstName = nameParts[0] || 'Email';
      const lastName = nameParts.slice(1).join(' ') || 'User';

      raiser = await prisma.user.create({
        data: {
          email: fromEmail,
          passwordHash: 'EMAIL_AUTO_CREATED_USER',
          firstName,
          lastName,
          role: 'RAISER',
          roles: ['RAISER'],
          status: 'ACTIVE',
          emailVerified: true,
          backupCodes: [],
        },
      });
      logger.info('Auto-created user from inbound email', { userId: raiser.id, email: fromEmail });
    }

    // 2. Check if Subject contains an existing Ticket Number (e.g. TKT-26-00040, HW-26-00001, INC-26-00001)
    const ticketMatch = subject.match(/(?:TKT|INC|HW|SW|[A-Z]{2,5})-\d{2}-\d{4,6}/i) || subject.match(/(?:TKT|INC|HW|SW|[A-Z]{2,5})-\d+/i);
    if (ticketMatch) {
      const ticketNumber = ticketMatch[0].toUpperCase();
      const existingTicket = await prisma.ticket.findUnique({
        where: { ticketNumber },
        include: { raisedBy: true, assignedTo: true, department: true },
      });

      if (existingTicket) {
        // Append email reply as a Comment
        const comment = await prisma.comment.create({
          data: {
            ticketId: existingTicket.id,
            userId: raiser.id,
            content: `📧 [Email Reply from ${fromEmail}]\n\n${body}`,
            isInternal: false,
            isSystem: false,
          },
        });

        // Re-open ticket if it was resolved
        if (existingTicket.status === TicketStatus.RESOLVED) {
          await prisma.ticket.update({
            where: { id: existingTicket.id },
            data: { status: TicketStatus.REOPENED, reopenedCount: { increment: 1 }, resolvedAt: null },
          });
        } else if (existingTicket.status === TicketStatus.DEPENDENCY_ON_CLIENT) {
          // If raiser replies to a ticket waiting on client, switch back to OPEN
          await prisma.ticket.update({
            where: { id: existingTicket.id },
            data: { status: TicketStatus.OPEN },
          });
        }

        await logActivity(raiser.id, 'COMMENT_ADDED', `Replied via email to ${ticketNumber}`, existingTicket.id);

        try {
          wsService.sendToTicket(existingTicket.id, 'comment:created', comment);
        } catch (_) {}

        return { action: 'COMMENT_ADDED', ticket: existingTicket };
      }
    }

    // 3. Route to relevant Department and Team based on recipient email (toEmail) or department supportEmail
    let department = await prisma.department.findFirst({
      where: {
        OR: [
          { supportEmail: { equals: toEmail, mode: 'insensitive' } },
          { name: { contains: toEmail.split('@')[0], mode: 'insensitive' } },
        ],
      },
    });

    let team = await prisma.team.findFirst({
      where: {
        OR: [
          { supportEmail: { equals: toEmail, mode: 'insensitive' } },
          { name: { contains: toEmail.split('@')[0], mode: 'insensitive' } },
        ],
      },
    });

    // Fallback: If no match found, route to IT / Projects department
    if (!department) {
      department = await prisma.department.findFirst({
        where: { OR: [{ type: 'IT' }, { name: { contains: 'IT', mode: 'insensitive' } }, { name: { contains: 'Hardware', mode: 'insensitive' } }] },
      });
      if (!department) {
        department = await prisma.department.findFirst();
      }
    }

    if (!team && department) {
      team = await prisma.team.findFirst({ where: { departmentId: department.id } });
    }

    // 4. Determine Category & SubCategory from email subject and body
    let category: TicketCategory = TicketCategory.INCIDENT;
    let subCategory: string | undefined;
    let subIssue: string | undefined;

    if (/laptop|desktop|monitor|printer|keyboard|mouse|hardware|ups|cctv|biometric/i.test(subject + body)) {
      category = TicketCategory.HARDWARE_REQUEST;
      if (/laptop/i.test(subject + body)) subCategory = 'Laptop';
      else if (/desktop/i.test(subject + body)) subCategory = 'Desktop';
      else if (/printer/i.test(subject + body)) subCategory = 'Printer';
      else if (/network|router|switch|wifi/i.test(subject + body)) subCategory = 'Network Hardware';
      else subCategory = 'Peripheral';
    } else if (/software|app|portal|dashboard|outlook|email|exchange|crm|synoriq|clu|bug|error/i.test(subject + body)) {
      category = TicketCategory.SOFTWARE_REQUEST;
      if (/outlook|email|exchange/i.test(subject + body)) {
        subCategory = 'Productivity Software';
        subIssue = 'Email / Outlook Access / Exchange Connection Issue';
      }
    } else if (/access|login|password|permission|id card/i.test(subject + body)) {
      category = TicketCategory.ACCESS_REQUEST;
    } else if (/security|firewall|virus|spam/i.test(subject + body)) {
      category = TicketCategory.SECURITY_INCIDENT;
    }

    // Find applicable SLA Policy
    const slaPolicy = await prisma.sLAPolicy.findFirst({
      where: {
        ...(department?.id ? { departmentId: department.id } : {}),
        isActive: true,
      },
      orderBy: { resolutionTimeMins: 'asc' },
    });

    let responseDueAt: Date | undefined;
    let resolutionDueAt: Date | undefined;
    if (slaPolicy) {
      responseDueAt = new Date(Date.now() + slaPolicy.responseTimeMins * 60 * 1000);
      resolutionDueAt = new Date(Date.now() + slaPolicy.resolutionTimeMins * 60 * 1000);
    }

    const ticketNumber = await this.generateTicketNumber(department?.id);

    const newTicket = await prisma.ticket.create({
      data: {
        ticketNumber,
        title: subject || 'No Subject (Created via Email)',
        description: body || 'Ticket raised via email.',
        status: TicketStatus.OPEN,
        priority: slaPolicy?.priority || TicketPriority.MEDIUM,
        category,
        subCategory,
        subIssue,
        group: team ? team.name : 'Inbound Support Queue',
        departmentId: department?.id || '',
        teamId: team?.id || undefined,
        raisedById: raiser.id,
        slaPolicyId: slaPolicy?.id || undefined,
        responseDueAt,
        resolutionDueAt,
      },
      include: {
        department: true,
        team: true,
        raisedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    await logActivity(raiser.id, 'TICKET_CREATED', `Raised ticket ${ticketNumber} via email to ${toEmail}`, newTicket.id);

    // Send confirmation email back to raiser
    try {
      await emailService.sendTicketCreatedEmail(
        fromEmail,
        ticketNumber,
        subject,
        config.frontendUrl
      );
    } catch (err) {
      logger.warn('Failed to send email confirmation to raiser', { error: err });
    }

    // Real-time broadcast
    try {
      if (department?.id) {
        wsService.sendToDepartment(department.id, 'ticket:created', newTicket);
      }
      wsService.broadcast('ticket:created', newTicket);
    } catch (_) {}

    return { action: 'TICKET_CREATED', ticket: newTicket };
  }
}

export default new InboundEmailService();
