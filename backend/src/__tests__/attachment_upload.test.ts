import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

const { root, uploadsDir, tmpDir } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fsH = require('fs'); const osH = require('os'); const pathH = require('path');
  const r = fsH.mkdtempSync(pathH.join(osH.tmpdir(), 'laxmi-upload-test-'));
  const t = pathH.join(r, 'upload-tmp');
  fsH.mkdirSync(t, { recursive: true });
  return { root: r as string, uploadsDir: pathH.join(r, 'uploads') as string, tmpDir: t as string };
});

vi.mock('@config/index', async (orig) => {
  const actual: any = await orig();
  const cfg = { ...actual.default, upload: { ...actual.default.upload, dir: uploadsDir } };
  return { ...actual, default: cfg, config: cfg };
});

const prismaMock = vi.hoisted(() => ({
  ticket: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
  attachment: { create: vi.fn() },
}));
vi.mock('@config/prisma', () => ({ prisma: prismaMock }));
vi.mock('@middleware/audit.middleware', () => ({ logActivity: vi.fn() }));

import { ticketService } from '../services/ticket.service';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, ...Array(32).fill(0)]);
const EXE = Buffer.from([0x4d, 0x5a, 0x90, 0x00, ...Array(60).fill(0)]);

function tempUpload(content: Buffer, originalname: string): Express.Multer.File {
  const p = path.join(tmpDir, `t-${Math.random().toString(36).slice(2)}`);
  fs.writeFileSync(p, content);
  return { path: p, size: content.length, originalname, mimetype: 'application/octet-stream' } as any;
}

const ticket = { id: 'tk1', ticketNumber: 'TKT-26-00099', departmentId: 'd1', raisedById: 'u1', assignedToId: null, department: { id: 'd1' }, watchers: [] };

describe('addAttachment — uploads saved via a temp file on disk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.ticket.findUnique.mockResolvedValue(ticket);
    prismaMock.user.findUnique.mockResolvedValue({ departmentId: 'd1' });
    prismaMock.attachment.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'a1', ...data }));
  });
  afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

  it('stores a valid image under uploads/tickets/<id>/ and removes the temp file', async () => {
    const file = tempUpload(PNG, 'screenshot.png');
    const a = await ticketService.addAttachment('tk1', 'u1', 'RAISER' as any, file);
    expect(a.mimeType).toBe('image/png');
    expect(a.path.startsWith(path.join(uploadsDir, 'tickets', 'tk1'))).toBe(true);
    expect(fs.existsSync(a.path)).toBe(true);
    expect(fs.existsSync(file.path)).toBe(false);
  });

  it('rejects an executable disguised as a PDF and deletes the temp file', async () => {
    const file = tempUpload(EXE, 'invoice.pdf');
    await expect(ticketService.addAttachment('tk1', 'u1', 'RAISER' as any, file)).rejects.toThrow();
    expect(fs.existsSync(file.path)).toBe(false);
    expect(prismaMock.attachment.create).not.toHaveBeenCalled();
  });

  it('deletes the temp file when the ticket does not exist', async () => {
    prismaMock.ticket.findUnique.mockResolvedValue(null);
    const file = tempUpload(PNG, 'a.png');
    await expect(ticketService.addAttachment('nope', 'u1', 'RAISER' as any, file)).rejects.toThrow('Ticket not found');
    expect(fs.existsSync(file.path)).toBe(false);
  });

  it('memory-stored files (no path) are reported clearly', async () => {
    await expect(ticketService.addAttachment('tk1', 'u1', 'RAISER' as any, { size: 10, originalname: 'x.png' } as any)).rejects.toThrow('could not be processed');
  });
});

describe('ticket attachment route uses disk storage', () => {
  it('route module configures a temp dir next to (not inside) uploads/', async () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'routes', 'ticket.routes.ts'), 'utf8');
    expect(src).toMatch(/multer\.diskStorage\(/);
    expect(src).not.toMatch(/multer\.memoryStorage\(/);
    expect(src).toMatch(/'\.\.', 'upload-tmp'/);
  });
});
