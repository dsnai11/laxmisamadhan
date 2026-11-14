import { TicketCategory } from '@prisma/client';

// Pure rules for per-department email-to-ticket. Unit-tested in
// src/__tests__/inbound_email.test.ts — keep behaviour changes here.

export interface MailboxCursor {
  uidValidity: string | null;
  lastUid: number | null;
}

export interface FetchPlan {
  /** true -> first run (or mailbox reset): record a starting point, process nothing */
  baseline: boolean;
  /** first UID to process when not a baseline run */
  fromUid: number | null;
  /** cursor to store if nothing new is processed */
  cursor: { uidValidity: string; lastUid: number };
}

/**
 * Decide which messages to read. On the first run, or when the server resets the mailbox
 * (UIDVALIDITY changes), we only record the current position so years of existing mail in a
 * department inbox do NOT all turn into tickets. After that, every UID above lastUid is new.
 * Read/unread flags are ignored, so a person opening the mailbox can't make the system miss mail.
 */
export function planFetch(cursor: MailboxCursor, mailbox: { uidValidity: string; uidNext: number }): FetchPlan {
  const current = { uidValidity: mailbox.uidValidity, lastUid: Math.max(0, mailbox.uidNext - 1) };
  if (cursor.lastUid == null || cursor.uidValidity == null || cursor.uidValidity !== mailbox.uidValidity) {
    return { baseline: true, fromUid: null, cursor: current };
  }
  return { baseline: false, fromUid: cursor.lastUid + 1, cursor: { uidValidity: mailbox.uidValidity, lastUid: cursor.lastUid } };
}

const DAEMON_SENDER = /(mailer-daemon|postmaster|no-?reply|do-?not-?reply)/i;
const AUTO_SUBJECT = /(delivery status notification|undeliver(ed|able)|mail delivery (failed|subsystem)|auto-?reply|automatic reply|out of (the )?office)/i;

/** Returns a reason to ignore the email, or null if it should be processed. */
export function skipReason(
  fromEmail: string,
  subject: string,
  opts: { systemAddresses: string[]; allowedDomains: string[] }
): string | null {
  const from = (fromEmail || '').trim().toLowerCase();
  if (!from || !from.includes('@')) return 'missing sender';
  if (DAEMON_SENDER.test(from) || AUTO_SUBJECT.test(subject || '')) return 'bounce / auto-reply';
  if (opts.systemAddresses.map((a) => a.toLowerCase()).includes(from)) return 'sent by the system itself (mail loop)';
  const domain = from.split('@')[1];
  if (opts.allowedDomains.length > 0 && !opts.allowedDomains.map((d) => d.toLowerCase()).includes(domain)) {
    return `sender domain ${domain} is not a company domain`;
  }
  return null;
}

const TICKET_NO = /\b([A-Z]{2,5}-\d{2}-\d{4,6})\b/i;

/** Ticket number like HW-26-00012 in a reply subject, upper-cased, or null. */
export function extractTicketNumber(subject: string): string | null {
  const m = (subject || '').match(TICKET_NO);
  return m ? m[1].toUpperCase() : null;
}

/**
 * An email reply may only be added to an existing ticket by people involved in it
 * (raiser, assignee, watcher) or support staff — anyone else gets a new ticket instead.
 */
export function canReplyToTicket(
  sender: { id: string; role?: string; roles?: string[] },
  ticket: { raisedById: string; assignedToId?: string | null; watcherIds?: string[] }
): boolean {
  if (sender.id === ticket.raisedById || sender.id === ticket.assignedToId) return true;
  if ((ticket.watcherIds || []).includes(sender.id)) return true;
  const roles = [sender.role, ...(sender.roles || [])];
  return roles.some((r) => r && ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD', 'TEAM_LEAD', 'AGENT'].includes(r));
}

/** Best-effort category from the email text (SLA and priority then follow the normal rules). */
export function guessCategory(subject: string, body: string): { category: TicketCategory; subCategory?: string } {
  const text = `${subject || ''} ${body || ''}`;
  if (/laptop|desktop|monitor|printer|keyboard|mouse|hardware|\bups\b|cctv|biometric|scanner/i.test(text)) {
    if (/laptop/i.test(text)) return { category: TicketCategory.HARDWARE_REQUEST, subCategory: 'Laptop' };
    if (/desktop/i.test(text)) return { category: TicketCategory.HARDWARE_REQUEST, subCategory: 'Desktop' };
    if (/printer/i.test(text)) return { category: TicketCategory.HARDWARE_REQUEST, subCategory: 'Printer' };
    return { category: TicketCategory.HARDWARE_REQUEST };
  }
  if (/security|firewall|virus|malware|phishing|spam/i.test(text)) return { category: TicketCategory.SECURITY_INCIDENT };
  if (/access|login|log in|password|permission|unlock|id card/i.test(text)) return { category: TicketCategory.ACCESS_REQUEST };
  if (/software|application|\bapp\b|portal|dashboard|outlook|email|exchange|crm|synoriq|clu|\blos\b|bug|error|install/i.test(text)) {
    return { category: TicketCategory.SOFTWARE_REQUEST };
  }
  return { category: TicketCategory.INCIDENT };
}
