import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { prisma } from '@config/prisma';
import { createLogger } from '@utils/logger';
import { decrypt } from '@utils/encryption';
import inboundEmailService from './inboundEmail.service';
import { planFetch } from './inboundRules';

const logger = createLogger('mail-poller');

const MAX_PER_RUN = 50; // per mailbox per cycle, so one busy inbox can't stall the others

export interface MailboxRunResult {
  departmentId: string;
  department: string;
  mailbox: string;
  ok: boolean;
  baseline?: boolean;
  processed: number;
  ticketsCreated: number;
  comments: number;
  skipped: number;
  error?: string;
}

type MailboxRow = Awaited<ReturnType<typeof loadMailboxes>>[number];

function loadMailboxes(departmentId?: string) {
  return prisma.departmentMailbox.findMany({
    where: { enabled: true, ...(departmentId ? { departmentId } : {}) },
    include: { department: { select: { id: true, name: true, supportEmail: true } } },
  });
}

/** Build an IMAP client for a department mailbox (username defaults to the department's support email). */
export function imapClientFor(mb: { host: string; port: number; username: string | null; encryptedPassword: string | null }, supportEmail: string | null) {
  const user = (mb.username || supportEmail || '').trim();
  if (!user) throw new Error('No mailbox address: set the department Inbound Support Email');
  if (!mb.encryptedPassword) throw new Error('No mailbox password saved');
  return new ImapFlow({
    host: mb.host,
    port: mb.port,
    secure: mb.port === 993,
    auth: { user, pass: decrypt(mb.encryptedPassword) },
    tls: { rejectUnauthorized: process.env.IMAP_REJECT_UNAUTHORIZED !== 'false' },
    logger: false,
  });
}

class MailPollerService {
  private timer: NodeJS.Timeout | null = null;
  private isPolling = false;
  private lastRunAt: Date | null = null;
  private lastResults: MailboxRunResult[] = [];

  start(intervalMs = 60_000): void {
    if (this.timer) return;
    logger.info('Starting per-department inbound mail poller');
    setTimeout(() => this.pollAll().catch((e) => logger.warn('Initial mail poll failed', { error: e.message })), 5_000);
    this.timer = setInterval(() => this.pollAll().catch((e) => logger.warn('Mail poll failed', { error: e.message })), intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /** Poll every enabled department mailbox (or just one). */
  async pollAll(departmentId?: string): Promise<MailboxRunResult[]> {
    if (this.isPolling) return this.lastResults;
    this.isPolling = true;
    try {
      const mailboxes = await loadMailboxes(departmentId);
      const results: MailboxRunResult[] = [];
      for (const mb of mailboxes) results.push(await this.pollMailbox(mb));
      this.lastRunAt = new Date();
      if (!departmentId) this.lastResults = results;
      return results;
    } finally {
      this.isPolling = false;
    }
  }

  private async pollMailbox(mb: MailboxRow): Promise<MailboxRunResult> {
    const address = (mb.username || mb.department.supportEmail || '').toLowerCase();
    const result: MailboxRunResult = {
      departmentId: mb.departmentId, department: mb.department.name, mailbox: address,
      ok: false, processed: 0, ticketsCreated: 0, comments: 0, skipped: 0,
    };
    let client: ImapFlow | null = null;
    try {
      client = imapClientFor(mb, mb.department.supportEmail);
      await client.connect();
      const lock = await client.getMailboxLock('INBOX', { readOnly: true });
      try {
        const box = client.mailbox as any;
        const plan = planFetch(
          { uidValidity: mb.uidValidity, lastUid: mb.lastUid },
          { uidValidity: String(box.uidValidity), uidNext: Number(box.uidNext) }
        );
        let cursor = plan.cursor;

        if (plan.baseline) {
          result.baseline = true;
          logger.info('Mailbox baseline recorded; existing mail will not be ticketed', { department: mb.department.name, lastUid: cursor.lastUid });
        } else if (plan.fromUid !== null && plan.fromUid < Number(box.uidNext)) {
          const uids = ((await client.search({ uid: `${plan.fromUid}:*` }, { uid: true })) || [])
            .filter((u: number) => u >= plan.fromUid!)
            .sort((a: number, b: number) => a - b)
            .slice(0, MAX_PER_RUN);

          for (const uid of uids) {
            try {
              const msg: any = await client.fetchOne(String(uid), { source: true }, { uid: true });
              if (msg?.source) {
                const parsed = await simpleParser(msg.source);
                const from = parsed.from?.value?.[0];
                const r = await inboundEmailService.processInboundEmail(
                  {
                    fromEmail: from?.address || '',
                    fromName: from?.name || '',
                    toEmail: address,
                    subject: parsed.subject || '',
                    body: parsed.text || (parsed.html ? String(parsed.html).replace(/<[^>]+>/g, ' ') : ''),
                  },
                  mb.departmentId
                );
                result.processed++;
                if (r.action === 'TICKET_CREATED') result.ticketsCreated++;
                else if (r.action === 'COMMENT_ADDED') result.comments++;
                else result.skipped++;
              }
            } catch (err: any) {
              // Logged and skipped so one bad message can't block the mailbox forever.
              logger.error('Failed to process inbound message', { department: mb.department.name, uid, error: err.message });
            }
            cursor = { uidValidity: cursor.uidValidity, lastUid: uid };
            await prisma.departmentMailbox.update({ where: { departmentId: mb.departmentId }, data: { lastUid: uid, uidValidity: cursor.uidValidity } });
          }
        }

        await prisma.departmentMailbox.update({
          where: { departmentId: mb.departmentId },
          data: {
            uidValidity: cursor.uidValidity,
            lastUid: cursor.lastUid,
            lastCheckedAt: new Date(),
            lastError: null,
            ticketsCreated: { increment: result.ticketsCreated },
          },
        });
        result.ok = true;
        if (result.processed > 0) logger.info('Inbound mailbox processed', { ...result });
      } finally {
        lock.release();
      }
      await client.logout();
    } catch (err: any) {
      result.error = err.message;
      logger.error('Inbound mailbox error', { department: mb.department.name, mailbox: address, error: err.message });
      await prisma.departmentMailbox
        .update({ where: { departmentId: mb.departmentId }, data: { lastCheckedAt: new Date(), lastError: String(err.message).slice(0, 500) } })
        .catch(() => undefined);
      try { if (client?.usable) await client.logout(); } catch (_) { /* ignore */ }
    }
    return result;
  }

  /** Back-compat for the admin "sync now" endpoint. */
  async checkInbox(): Promise<{ processed: number; results: MailboxRunResult[] }> {
    const results = await this.pollAll();
    return { processed: results.reduce((n, r) => n + r.processed, 0), results };
  }

  getStatus() {
    return { isPolling: this.isPolling, lastRunAt: this.lastRunAt, mailboxes: this.lastResults };
  }
}

export const mailPollerService = new MailPollerService();
export default mailPollerService;
