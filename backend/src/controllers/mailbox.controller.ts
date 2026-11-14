import { Response } from 'express';
import { z } from 'zod';
import { asyncHandler, AppError } from '@middleware/error.middleware';
import { AuthenticatedRequest } from '@middleware/auth.middleware';
import { logActivity } from '@middleware/audit.middleware';
import { prisma } from '@config/prisma';
import { encrypt } from '@utils/encryption';
import mailPollerService, { imapClientFor } from '@services/mailPoller.service';

// Department email-to-ticket mailbox. The password is write-only: it is encrypted at rest
// and never returned — responses only say whether one is saved.

const updateSchema = z.object({
  enabled: z.boolean().optional(),
  host: z.string().trim().min(1).max(200).optional(),
  port: z.number().int().min(1).max(65535).optional(),
  username: z.string().trim().max(200).optional().nullable(),
  password: z.string().min(1).max(500).optional(), // omit to keep the saved password
});

function publicView(dept: { id: string; supportEmail: string | null }, mb: any) {
  return {
    departmentId: dept.id,
    address: (mb?.username || dept.supportEmail || null),
    supportEmail: dept.supportEmail,
    enabled: !!mb?.enabled,
    host: mb?.host || 'mail.lifc.in',
    port: mb?.port || 993,
    username: mb?.username || null,
    hasPassword: !!mb?.encryptedPassword,
    lastCheckedAt: mb?.lastCheckedAt || null,
    lastError: mb?.lastError || null,
    ticketsCreated: mb?.ticketsCreated || 0,
    tracking: mb?.lastUid != null,
  };
}

async function loadDept(id: string) {
  const dept = await prisma.department.findUnique({ where: { id }, select: { id: true, name: true, supportEmail: true } });
  if (!dept) throw new AppError('Department not found', 404, 'NOT_FOUND');
  return dept;
}

export const getMailbox = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const dept = await loadDept(req.params.id);
  const mb = await prisma.departmentMailbox.findUnique({ where: { departmentId: dept.id } });
  res.json({ success: true, data: publicView(dept, mb) });
});

export const updateMailbox = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const dept = await loadDept(req.params.id);
  const body = updateSchema.parse(req.body);
  const existing = await prisma.departmentMailbox.findUnique({ where: { departmentId: dept.id } });

  if (body.enabled && !dept.supportEmail && !body.username && !existing?.username) {
    throw new AppError('Set the department Inbound Support Email before enabling email-to-ticket', 400, 'NO_SUPPORT_EMAIL');
  }
  if (body.enabled && !body.password && !existing?.encryptedPassword) {
    throw new AppError('Enter the mailbox password before enabling email-to-ticket', 400, 'NO_PASSWORD');
  }

  const data: any = {};
  if (body.enabled !== undefined) data.enabled = body.enabled;
  if (body.host !== undefined) data.host = body.host;
  if (body.port !== undefined) data.port = body.port;
  if (body.username !== undefined) data.username = body.username || null;
  if (body.password) data.encryptedPassword = encrypt(body.password);
  // A different mailbox/server means a fresh starting point (existing mail there is not ticketed).
  if ((body.host && body.host !== existing?.host) || (body.username !== undefined && (body.username || null) !== (existing?.username ?? null))) {
    data.lastUid = null;
    data.uidValidity = null;
  }

  const mb = await prisma.departmentMailbox.upsert({
    where: { departmentId: dept.id },
    create: { departmentId: dept.id, ...data },
    update: data,
  });

  await logActivity(req.user!.userId, 'DEPARTMENT_MAILBOX_UPDATED', `Updated email-to-ticket mailbox for ${dept.name}`, undefined, {
    departmentId: dept.id,
    enabled: mb.enabled,
    host: mb.host,
    passwordChanged: !!body.password,
  });
  res.json({ success: true, data: publicView(dept, mb) });
});

/** Try logging in with the saved (or a just-typed, unsaved) password. Nothing is read or changed. */
export const testMailbox = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const dept = await loadDept(req.params.id);
  const body = updateSchema.pick({ host: true, port: true, username: true, password: true }).parse(req.body || {});
  const mb = await prisma.departmentMailbox.findUnique({ where: { departmentId: dept.id } });
  const cfg = {
    host: body.host || mb?.host || 'mail.lifc.in',
    port: body.port || mb?.port || 993,
    username: body.username ?? mb?.username ?? null,
    encryptedPassword: body.password ? encrypt(body.password) : (mb?.encryptedPassword ?? null),
  };

  let client;
  try {
    client = imapClientFor(cfg, dept.supportEmail);
    await client.connect();
    const status: any = await client.status('INBOX', { messages: true, unseen: true });
    await client.logout();
    res.json({ success: true, data: { ok: true, address: cfg.username || dept.supportEmail, messages: Number(status.messages || 0), unread: Number(status.unseen || 0) } });
  } catch (err: any) {
    try { if (client?.usable) await client.logout(); } catch (_) { /* ignore */ }
    res.json({ success: true, data: { ok: false, address: cfg.username || dept.supportEmail, error: err.responseText || err.message } });
  }
});

/** Poll this department's mailbox now instead of waiting for the next minute. */
export const checkMailboxNow = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const dept = await loadDept(req.params.id);
  const [result] = await mailPollerService.pollAll(dept.id);
  const mb = await prisma.departmentMailbox.findUnique({ where: { departmentId: dept.id } });
  res.json({ success: true, data: { result: result || null, mailbox: publicView(dept, mb) } });
});
