import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import config from '@config/index';
import logger from '@utils/logger';
import inboundEmailService from './inboundEmail.service';

class MailPollerService {
  private client: ImapFlow | null = null;
  private isPolling = false;
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private lastPollAt: Date | null = null;
  private lastError: string | null = null;
  private totalProcessed = 0;

  private getImapConfig() {
    return {
      host: process.env.IMAP_HOST || config.email.host || 'mail.lifc.in',
      port: parseInt(process.env.IMAP_PORT || '993', 10),
      secure: process.env.IMAP_SECURE !== 'false',
      auth: {
        user: process.env.IMAP_USER || config.email.user || 'laxmisamadhan@lifc.in',
        pass: process.env.IMAP_PASS || config.email.pass || '',
      },
      tls: {
        rejectUnauthorized: false,
      },
      logger: false,
    };
  }

  public start(intervalMs: number = 60000): void {
    if (this.isRunning) return;
    this.isRunning = true;
    logger.info('Starting Inbound Mail Poller service...');

    // Run first check after 5 seconds of server startup
    setTimeout(() => {
      this.checkInbox().catch((err) => logger.warn('Initial mail poll warning', { error: err.message }));
    }, 5000);

    // Schedule regular polling every intervalMs (default 60 seconds)
    this.timer = setInterval(() => {
      this.checkInbox().catch((err) => logger.warn('Scheduled mail poll warning', { error: err.message }));
    }, intervalMs);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    logger.info('Inbound Mail Poller service stopped.');
  }

  public async checkInbox(): Promise<{ processed: number; errors: any[] }> {
    if (this.isPolling) {
      logger.info('Mail poller is already running a check, skipping concurrent poll.');
      return { processed: 0, errors: [] };
    }

    const imapConfig = this.getImapConfig();
    if (!imapConfig.auth.user || !imapConfig.auth.pass) {
      logger.warn('Inbound Mail Poller skipped: Missing IMAP credentials.');
      return { processed: 0, errors: ['Missing IMAP credentials'] };
    }

    this.isPolling = true;
    this.lastPollAt = new Date();
    this.lastError = null;
    let processedCount = 0;
    const errors: any[] = [];

    const client = new ImapFlow(imapConfig as any);

    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');

      try {
        const uids = await client.search({ seen: false }, { uid: true });
        if (uids && uids.length > 0) {
          logger.info(`Found ${uids.length} unread email(s) in INBOX.`);

          for (const uid of uids) {
            try {
              const msg = await client.fetchOne(uid, { source: true, envelope: true }, { uid: true });
              if (!msg || !msg.source) continue;

              const parsed = await simpleParser(msg.source);
              const fromEmail = parsed.from?.value?.[0]?.address || '';
              const fromName = parsed.from?.value?.[0]?.name || parsed.from?.text || fromEmail;
              const toEmail = parsed.to
                ? Array.isArray(parsed.to)
                  ? parsed.to[0]?.value?.[0]?.address || 'laxmisamadhan@lifc.in'
                  : (parsed.to as any).value?.[0]?.address || 'laxmisamadhan@lifc.in'
                : 'laxmisamadhan@lifc.in';
              const subject = parsed.subject || 'No Subject';
              const body = parsed.text || (parsed.html ? parsed.html.replace(/<[^>]+>/g, ' ') : '') || '';

              // Skip bounce / delivery status / mailer-daemon emails
              if (
                /mailer-daemon|postmaster|no-reply|noreply/i.test(fromEmail) ||
                /delivery status notification|undelivered mail|auto-reply/i.test(subject)
              ) {
                logger.info('Skipping daemon/bounce email', { fromEmail, subject });
                await client.messageFlagsAdd({ uid }, ['\\Seen'], { uid: true });
                continue;
              }

              // Extract attachments if any
              const attachments = (parsed.attachments || []).map((att) => ({
                fileName: att.filename || 'attachment',
                mimeType: att.contentType || 'application/octet-stream',
                content: att.content ? att.content.toString('base64') : undefined,
              }));

              await inboundEmailService.processInboundEmail({
                fromEmail,
                fromName,
                toEmail,
                subject,
                body,
                attachments,
              });

              // Mark email as seen so it will not be processed again
              await client.messageFlagsAdd({ uid }, ['\\Seen'], { uid: true });
              processedCount++;
              this.totalProcessed++;
              logger.info('Successfully processed inbound email', { fromEmail, subject, uid });
            } catch (err: any) {
              logger.error('Failed to process message uid ' + uid, { error: err.message });
              errors.push({ uid, error: err.message });
            }
          }
        }
      } finally {
        lock.release();
      }

      await client.logout();
    } catch (err: any) {
      this.lastError = err.message;
      logger.error('Inbound mail poller connection error', { error: err.message });
      errors.push({ error: err.message });
    } finally {
      this.isPolling = false;
      try {
        if (client.usable) await client.logout();
      } catch (_) {}
    }

    return { processed: processedCount, errors };
  }

  public getStatus() {
    return {
      isRunning: this.isRunning,
      isPolling: this.isPolling,
      lastPollAt: this.lastPollAt,
      lastError: this.lastError,
      totalProcessed: this.totalProcessed,
      host: this.getImapConfig().host,
      user: this.getImapConfig().auth.user,
    };
  }
}

export const mailPollerService = new MailPollerService();
export default mailPollerService;
