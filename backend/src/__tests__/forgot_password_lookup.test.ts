import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  user: { findMany: vi.fn(), update: vi.fn() },
}));
const emailMock = vi.hoisted(() => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(true),
}));

vi.mock('@config/prisma', () => ({ prisma: prismaMock }));
vi.mock('../services/email.service', () => ({ default: emailMock, emailService: emailMock }));

import { authService } from '../services/auth.service';

const user = { id: 'u1', email: 'someone@lifc.in', employeeId: '5487' };

function lastWhereOr(): any[] {
  return prismaMock.user.findMany.mock.calls.at(-1)![0].where.OR;
}

describe('Forgot password: employee code / email lookup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.update.mockResolvedValue(user);
  });

  it.each(['5487', 'LIF5487', '05487', 'lif-5487', ' 5487 '])(
    'sends the reset email when "%s" matches exactly one account',
    async (input) => {
      prismaMock.user.findMany.mockResolvedValue([user]);

      await authService.forgotPassword(input);

      const candidates: string[] = lastWhereOr()[0].employeeId.in;
      expect(candidates).toContain('5487');
      expect(emailMock.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
      expect(emailMock.sendPasswordResetEmail.mock.calls[0][0]).toBe('someone@lifc.in');
    }
  );

  it('also works with the registered email address', async () => {
    prismaMock.user.findMany.mockResolvedValue([user]);

    await authService.forgotPassword('Someone@LIFC.in');

    expect(lastWhereOr()[1].email.equals).toBe('someone@lifc.in');
    expect(emailMock.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
  });

  it('no longer uses a partial "ends with" match', async () => {
    prismaMock.user.findMany.mockResolvedValue([]);

    await authService.forgotPassword('87');

    const hasEndsWith = lastWhereOr().some((c: any) => c.employeeId?.endsWith !== undefined);
    expect(hasEndsWith).toBe(false);
    expect(emailMock.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('sends nothing when the identifier matches more than one account', async () => {
    prismaMock.user.findMany.mockResolvedValue([user, { ...user, id: 'u2', email: 'other@lifc.in' }]);

    await authService.forgotPassword('5487');

    expect(emailMock.sendPasswordResetEmail).not.toHaveBeenCalled();
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('sends nothing for an unknown identifier', async () => {
    prismaMock.user.findMany.mockResolvedValue([]);

    await authService.forgotPassword('9999');

    expect(emailMock.sendPasswordResetEmail).not.toHaveBeenCalled();
  });
});

describe('Login: employee code lookup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not use a partial "ends with" match and never touches another account', async () => {
    prismaMock.user.findMany.mockResolvedValue([]);

    await expect(authService.login('7', 'wrong-password')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });

    const or = prismaMock.user.findMany.mock.calls.at(-1)![0].where.OR;
    expect(or.some((c: any) => c.employeeId?.endsWith !== undefined)).toBe(false);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('treats an identifier matching several accounts as invalid instead of picking one', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      { id: 'a', passwordHash: 'x', failedLoginAttempts: 0 },
      { id: 'b', passwordHash: 'y', failedLoginAttempts: 0 },
    ]);

    await expect(authService.login('5487', 'whatever')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });
});
