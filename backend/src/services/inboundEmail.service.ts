import { config } from '@config/index';
import { prisma } from '@config/prisma';
import logger from '@utils/logger';
import { logActivity } from '@middleware/audit.middleware';
import emailService from './email.service';
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
   * Helper to generate unique ticket number INC-YY-XXXXX
   */
  private async generateTicketNumber(departmentId?: string): Promise<string> {
    const year = new Date().getFullYear().toString().slice(-2);
    const count = await prisma.ticket.count();
    let seq = count + 1;
    let ticketNumber = `INC-${year}-${String(seq).padStart(5, '0')}`;
    while (await prisma.ticket.findUnique({ where: { ticketNumber }, select: { id: true } })) {
      seq++;
      ticketNumber = `INC-${year}-${String(seq).padStart(5, '0')}`;
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
          status: 'ACTIVE',
          emailVerified: true,
          backupCodes: [],
        },
      });
      logger.info('Auto-created user from inbound email', { userId: raiser.id, email: fromEmail });
    }

    // 2. Check if Subject contains an existing Ticket Number (e.g., [INC-1024] or INC-1024)
    const ticketMatch = subject.match(/INC-\d+/i);
    if (ticketMatch) {
      const ticketNumber = ticketMatch[0].toUpperCase();
      const existingTicket = await prisma.ticket.findUnique({
        where: { ticketNumber },
        include: { raisedBy: true },
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

        // Re-open ticket if it was resolved/closed
        if (['RESOLVED', 'CLOSED'].includes(existingTicket.status)) {
          await prisma.ticket.update({
            where: { id: existingTicket.id },
            data: { status: 'IN_PROGRESS', reopenedCount: { increment: 1 } },
          });
        }

        await logActivity(raiser.id, 'COMMENT_ADDED', `Replied via email to ${ticketNumber}`, existingTicket.id);

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
        where: { OR: [{ type: 'IT' }, { name: { contains: 'IT', mode: 'insensitive' } }, { name: { contains: 'Project', mode: 'insensitive' } }] },
      });
      if (!department) {
        department = await prisma.department.findFirst();
      }
    }

    if (!team && department) {
      team = await prisma.team.findFirst({ where: { departmentId: department.id } });
    }

    // 4. Determine Category & Group from content
    let category: TicketCategory = TicketCategory.INCIDENT;
    if (/access|login|password|permission/i.test(subject + body)) category = TicketCategory.ACCESS_REQUEST;
    else if (/software|app|portal|dashboard|bug/i.test(subject + body)) category = TicketCategory.SOFTWARE_REQUEST;
    else if (/hardware|laptop|mouse|keyboard|monitor|printer/i.test(subject + body)) category = TicketCategory.HARDWARE_REQUEST;
    else if (/security|firewall|virus|spam/i.test(subject + body)) category = TicketCategory.SECURITY_INCIDENT;

    const ticketNumber = await this.generateTicketNumber(department?.id);

    const newTicket = await prisma.ticket.create({
      data: {
        ticketNumber,
        title: subject || 'No Subject (Created via Email)',
        description: body || 'Ticket raised via email.',
        status: TicketStatus.OPEN,
        priority: TicketPriority.MEDIUM,
        category,
        group: team ? team.name : 'Inbound Support Queue',
        departmentId: department?.id || '',
        teamId: team?.id || undefined,
        raisedById: raiser.id,
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

    return { action: 'TICKET_CREATED', ticket: newTicket };
  }
}

export default new InboundEmailService();
