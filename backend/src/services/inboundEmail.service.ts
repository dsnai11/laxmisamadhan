import { config } from '@config/index';
import { prisma } from '@config/prisma';
import logger from '@utils/logger';
import { logActivity } from '@middleware/audit.middleware';
import wsService from './websocket.service';
import ticketService from './ticket.service';
import { TicketPriority, TicketStatus } from '@prisma/client';
import { skipReason, extractTicketNumber, canReplyToTicket, guessCategory } from './inboundRules';

export interface InboundEmailPayload {
  fromEmail: string;
  fromName?: string;
  toEmail: string;
  subject: string;
  body: string;
  attachments?: { fileName: string; mimeType: string; content?: string }[];
}

export type InboundResult =
  | { action: 'TICKET_CREATED'; ticket: any }
  | { action: 'COMMENT_ADDED'; ticket: any }
  | { action: 'SKIPPED'; reason: string };

const clean = (v?: string) => (v || '').replace(/^["']|["']$/g, '').trim().toLowerCase();

class InboundEmailService {
  /** Addresses the system sends from or receives on — mail from these is never ticketed (loop guard). */
  async systemAddresses(): Promise<string[]> {
    const depts = await prisma.department.findMany({ where: { supportEmail: { not: null } }, select: { supportEmail: true } });
    const fromHeader = clean(config.email.from).match(/<([^>]+)>/)?.[1] || clean(config.email.from);
    return Array.from(new Set([clean(config.email.user), fromHeader, ...depts.map((d) => clean(d.supportEmail || ''))].filter(Boolean)));
  }

  /** Company mail domains (from department addresses and the system mailbox). Only these may raise tickets. */
  async allowedDomains(): Promise<string[]> {
    return Array.from(new Set((await this.systemAddresses()).map((a) => a.split('@')[1]).filter(Boolean)));
  }

  /**
   * Turn one email into a ticket (or a reply comment) for the given department.
   * departmentId is the department whose mailbox received the email. Without it (admin
   * simulator / webhook) the department is looked up by the recipient's support address.
   */
  async processInboundEmail(payload: InboundEmailPayload, departmentId?: string): Promise<InboundResult> {
    const fromEmail = clean(payload.fromEmail);
    const toEmail = clean(payload.toEmail);
    const subject = (payload.subject || '').trim() || 'No subject (raised via email)';
    const body = (payload.body || '').trim();

    const reason = skipReason(fromEmail, subject, {
      systemAddresses: await this.systemAddresses(),
      allowedDomains: await this.allowedDomains(),
    });
    if (reason) {
      logger.info('Inbound email skipped', { reason, subject: subject.slice(0, 80) });
      return { action: 'SKIPPED', reason };
    }

    const department = departmentId
      ? await prisma.department.findUnique({ where: { id: departmentId } })
      : await prisma.department.findFirst({ where: { supportEmail: { equals: toEmail, mode: 'insensitive' } } });
    if (!department) {
      logger.warn('Inbound email skipped: no department uses this support address', { toEmail });
      return { action: 'SKIPPED', reason: `no department has support email ${toEmail}` };
    }

    // Sender -> user (auto-create a raiser account for colleagues not yet in the portal).
    let raiser = await prisma.user.findFirst({ where: { email: { equals: fromEmail, mode: 'insensitive' } } });
    if (!raiser) {
      const nameParts = (payload.fromName || fromEmail.split('@')[0]).trim().split(/\s+/);
      raiser = await prisma.user.create({
        data: {
          email: fromEmail,
          passwordHash: 'EMAIL_AUTO_CREATED_USER',
          firstName: nameParts[0] || 'Email',
          lastName: nameParts.slice(1).join(' ') || 'User',
          role: 'RAISER',
          roles: ['RAISER'],
          status: 'ACTIVE',
          emailVerified: true,
          backupCodes: [],
        },
      });
      logger.info('Auto-created raiser from inbound email', { userId: raiser.id, departmentId: department.id });
    }

    // Reply to an existing ticket? Only people involved in it (or staff) may comment by email.
    const ticketNumber = extractTicketNumber(subject);
    if (ticketNumber) {
      const existing = await prisma.ticket.findUnique({
        where: { ticketNumber },
        include: { watchers: { select: { userId: true } } },
      });
      if (existing && canReplyToTicket(raiser, { ...existing, watcherIds: existing.watchers.map((w) => w.userId) })) {
        const comment = await prisma.comment.create({
          data: { ticketId: existing.id, userId: raiser.id, content: `📧 Email reply:\n\n${body}`, isInternal: false, isSystem: false },
        });
        if (existing.status === TicketStatus.RESOLVED) {
          await prisma.ticket.update({
            where: { id: existing.id },
            data: { status: TicketStatus.REOPENED, reopenedCount: { increment: 1 }, resolvedAt: null },
          });
        } else if (existing.status === TicketStatus.DEPENDENCY_ON_CLIENT && raiser.id === existing.raisedById) {
          await prisma.ticket.update({ where: { id: existing.id }, data: { status: TicketStatus.OPEN } });
        }
        await logActivity(raiser.id, 'COMMENT_ADDED', `Replied via email to ${ticketNumber}`, existing.id);
        try { wsService.sendToTicket(existing.id, 'comment:created', comment); } catch (_) { /* best effort */ }
        return { action: 'COMMENT_ADDED', ticket: existing };
      }
    }

    // New ticket: same path as the web form -> SLA/priority rules, team routing,
    // round-robin auto-assignment, notifications and the confirmation email to the raiser.
    const { category, subCategory } = guessCategory(subject, body);
    const ticket = await ticketService.createTicket({
      title: subject.slice(0, 250),
      description: body || 'Ticket raised via email.',
      category,
      subCategory: subCategory || null,
      priority: TicketPriority.MEDIUM,
      departmentId: department.id,
      raisedById: raiser.id,
      tags: ['EMAIL'],
    });

    await logActivity(raiser.id, 'TICKET_CREATED_VIA_EMAIL', `Raised ${ticket.ticketNumber} via email to ${department.supportEmail || toEmail}`, ticket.id);
    return { action: 'TICKET_CREATED', ticket };
  }
}

export const inboundEmailService = new InboundEmailService();
export default inboundEmailService;
