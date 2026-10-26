import { Request, Response } from 'express';
import { asyncHandler } from '@middleware/error.middleware';
import { AppError } from '@middleware/error.middleware';
import userService from '@services/user.service';
import { AuthenticatedRequest } from '@middleware/auth.middleware';
import { UserRole, UserStatus } from '@prisma/client';
import { assertCanAssignRole, assertCanManageUser, isOrgWide, Actor } from '@utils/userAccess';

const actorOf = (req: AuthenticatedRequest): Actor => ({
  userId: req.user!.userId,
  role: req.user!.role,
  roles: req.user!.roles,
  departmentId: req.user!.departmentId,
});

export const createUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const actor = actorOf(req);
  const targetRoles = req.body.roles && req.body.roles.length > 0 ? req.body.roles : [req.body.role || 'RAISER'];
  assertCanAssignRole(actor, targetRoles);
  if (!isOrgWide(actor)) {
    if (!actor.departmentId) throw new AppError('You are not assigned to a department', 403, 'FORBIDDEN');
    req.body.departmentId = actor.departmentId;
  }
  const user = await userService.createUser(req.body, req.user!.userId);

  res.status(201).json({
    success: true,
    message: 'User created successfully',
    data: user,
  });
});

export const bulkCreateUsers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { users } = req.body;
  const actor = actorOf(req);

  for (const u of users) {
    const targetRoles = u.roles && u.roles.length > 0 ? u.roles : [u.role || 'RAISER'];
    assertCanAssignRole(actor, targetRoles);
    if (!isOrgWide(actor)) {
      if (!actor.departmentId) throw new AppError('You are not assigned to a department', 403, 'FORBIDDEN');
      u.departmentId = actor.departmentId;
    }
  }

  const result = await userService.bulkCreateUsers(users, req.user!.userId);

  res.status(201).json({
    success: true,
    message: `Bulk user creation completed: ${result.success} succeeded, ${result.failed} failed`,
    data: result,
  });
});

export const getUsers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const params = {
    page: parseInt(req.query.page as string) || 1,
    limit: parseInt(req.query.limit as string) || 20,
    sortBy: req.query.sortBy as string || 'createdAt',
    sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
    search: req.query.search as string,
    role: req.query.role as UserRole,
    status: req.query.status as UserStatus,
    departmentId: isOrgWide(actorOf(req)) ? (req.query.departmentId as string) : (req.user!.departmentId || 'none'),
    managerId: req.query.managerId as string,
    canViewTeamBucket: req.query.canViewTeamBucket !== undefined
      ? req.query.canViewTeamBucket === 'true' || req.query.canViewTeamBucket === true
      : undefined,
    dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
    dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
  };

  const result = await userService.getUsers(params);

  res.json({
    success: true,
    data: result,
  });
});

export const getUserById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await assertCanManageUser(actorOf(req), req.params.id, { allowSelf: true });
  const user = await userService.getUserById(req.params.id);

  res.json({
    success: true,
    data: user,
  });
});

export const updateUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const actor = actorOf(req);
  await assertCanManageUser(actor, req.params.id, { allowSelf: true });
  if (req.body.role) assertCanAssignRole(actor, req.body.role);
  if (req.body.roles) assertCanAssignRole(actor, req.body.roles);
  if (!isOrgWide(actor) && req.body.departmentId !== undefined && req.body.departmentId !== actor.departmentId) {
    throw new AppError('You can only keep users in your own department', 403, 'FORBIDDEN');
  }
  if (req.body.canViewTeamBucket !== undefined) {
    const isSuperAdmin = actor.role === 'SUPER_ADMIN' || (actor.roles && actor.roles.includes('SUPER_ADMIN'));
    if (!isSuperAdmin) {
      throw new AppError('Only Super Admin can grant or revoke Team Bucket access', 403, 'FORBIDDEN');
    }
  }
  const user = await userService.updateUser(req.params.id, req.body, req.user!.userId);

  res.json({
    success: true,
    message: 'User updated successfully',
    data: user,
  });
});

export const updateUserRole = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { role, roles } = req.body;
  const actor = actorOf(req);
  await assertCanManageUser(actor, req.params.id);
  const targetRoles = roles && roles.length > 0 ? roles : (role ? [role] : []);
  assertCanAssignRole(actor, targetRoles);
  
  const user = await userService.updateUserRole(req.params.id, targetRoles, req.user!.userId);

  res.json({
    success: true,
    message: 'User role updated successfully',
    data: user,
  });
});

export const updateUserStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { status, reason } = req.body;
  await assertCanManageUser(actorOf(req), req.params.id);
  
  const user = await userService.updateUserStatus(req.params.id, status, req.user!.userId, reason);

  res.json({
    success: true,
    message: 'User status updated successfully',
    data: user,
  });
});

export const resetUserPassword = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await assertCanManageUser(actorOf(req), req.params.id);
  await userService.resetPassword(req.params.id, req.body.password, req.user!.userId);

  res.json({
    success: true,
    message: 'Password reset. The user has been signed out everywhere.',
  });
});

export const deleteUser = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await assertCanManageUser(actorOf(req), req.params.id);
  await userService.deleteUser(req.params.id, req.user!.userId);

  res.json({
    success: true,
    message: 'User deleted successfully',
  });
});

export const bulkUserAction = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userIds, action, data } = req.body;
  const actor = actorOf(req);
  for (const id of userIds) await assertCanManageUser(actor, id);
  if (action === 'changeRole' && data?.role) assertCanAssignRole(actor, data.role);
  
  const result = await userService.bulkAction(userIds, action, data, req.user!.userId);

  res.json({
    success: true,
    message: `Bulk action completed: ${result.success} succeeded, ${result.failed} failed`,
    data: result,
  });
});

export const getUserStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const stats = await userService.getUserStats();

  res.json({
    success: true,
    data: stats,
  });
});

export const getSubordinates = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const subordinates = await userService.getSubordinates(req.user!.userId);

  res.json({
    success: true,
    data: subordinates,
  });
});

export const searchUsers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { q, limit } = req.query;
  
  const users = await userService.searchUsers(q as string, parseInt(limit as string) || 10);

  res.json({
    success: true,
    data: users,
  });
});

export const getProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const user = await userService.getUserById(req.user!.userId);

  res.json({
    success: true,
    data: user,
  });
});

export const updateProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { firstName, lastName, phone, avatar } = req.body;
  const user = await userService.updateUser(req.user!.userId, { firstName, lastName, phone, avatar }, req.user!.userId);

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: user,
  });
});