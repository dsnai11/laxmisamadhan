import { Request, Response } from 'express';
import { asyncHandler } from '@middleware/error.middleware';
import { AppError } from '@middleware/error.middleware';
import departmentService from '@services/department.service';
import { AuthenticatedRequest } from '@middleware/auth.middleware';
import { DepartmentType } from '@prisma/client';

export const createDepartment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const department = await departmentService.createDepartment(req.body, req.user!.userId);

  res.status(201).json({
    success: true,
    message: 'Department created successfully',
    data: department,
  });
});

export const getDepartments = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const departments = await departmentService.getDepartments();

  res.json({
    success: true,
    data: departments,
  });
});

export const getDepartmentTree = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const tree = await departmentService.getDepartmentTree();

  res.json({
    success: true,
    data: tree,
  });
});

export const getDepartmentById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const department = await departmentService.getDepartmentById(req.params.id);

  res.json({
    success: true,
    data: department,
  });
});

export const updateDepartment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const department = await departmentService.updateDepartment(
    req.params.id,
    req.body,
    req.user!.userId,
    req.user!.role,
    req.user!.departmentId
  );

  res.json({
    success: true,
    message: 'Department updated successfully',
    data: department,
  });
});

export const deleteDepartment = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await departmentService.deleteDepartment(req.params.id, req.user!.userId);

  res.json({
    success: true,
    message: 'Department deleted successfully',
  });
});

export const assignHead = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { headId } = req.body;
  
  const department = await departmentService.assignHead(req.params.id, headId, req.user!.userId);

  res.json({
    success: true,
    message: headId ? 'Department head assigned successfully' : 'Department head removed successfully',
    data: department,
  });
});

export const getDepartmentStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const stats = await departmentService.getDepartmentStats(req.params.id);

  res.json({
    success: true,
    data: stats,
  });
});

export const createCategoryConfig = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (['DEPARTMENT_HEAD', 'TEAM_LEAD'].includes(req.user!.role) && req.user!.departmentId !== req.params.id) {
    throw new AppError('You can only configure categories for your own department', 403, 'FORBIDDEN');
  }
  const { category, ...data } = req.body;
  
  const config = await departmentService.createCategoryConfig(req.params.id, category, data);

  res.status(201).json({
    success: true,
    message: 'Category configuration created successfully',
    data: config,
  });
});

export const updateCategoryConfig = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (['DEPARTMENT_HEAD', 'TEAM_LEAD'].includes(req.user!.role) && req.user!.departmentId !== req.params.id) {
    throw new AppError('You can only configure categories for your own department', 403, 'FORBIDDEN');
  }
  const { category, ...data } = req.body;
  
  const config = await departmentService.updateCategoryConfig(req.params.id, req.params.category || category, data);

  res.json({
    success: true,
    message: 'Category configuration updated successfully',
    data: config,
  });
});

export const deleteCategoryConfig = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (['DEPARTMENT_HEAD', 'TEAM_LEAD'].includes(req.user!.role) && req.user!.departmentId !== req.params.id) {
    throw new AppError('You can only delete categories for your own department', 403, 'FORBIDDEN');
  }
  await departmentService.deleteCategoryConfig(req.params.id, req.params.category);

  res.json({
    success: true,
    message: 'Category configuration deleted successfully',
  });
});

export const getCategoryConfigs = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const configs = await departmentService.getCategoryConfigs(req.params.id);

  res.json({
    success: true,
    data: configs,
  });
});

export const createTeam = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const team = await departmentService.createTeam(
    req.params.id,
    req.body,
    req.user!.userId,
    req.user!.role,
    req.user!.departmentId
  );

  res.status(201).json({
    success: true,
    message: 'Team created successfully',
    data: team,
  });
});

export const getTeams = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const teams = await departmentService.getTeams(req.params.id);

  res.json({
    success: true,
    data: teams,
  });
});

export const updateTeam = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const team = await departmentService.updateTeam(
    req.params.teamId,
    req.body,
    req.user!.userId,
    req.user!.role,
    req.user!.departmentId
  );

  res.json({
    success: true,
    message: 'Team updated successfully',
    data: team,
  });
});

export const deleteTeam = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await departmentService.deleteTeam(
    req.params.teamId,
    req.user!.userId,
    req.user!.role,
    req.user!.departmentId
  );

  res.json({
    success: true,
    message: 'Team deleted successfully',
  });
});

export const getTeamBucket = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { page, limit, status, assignedToId, priority } = req.query as any;

  const result = await departmentService.getTeamBucket(
    req.params.teamId,
    { page: page ? parseInt(page) : 1, limit: limit ? parseInt(limit) : 20, status, assignedToId, priority },
    req.user!.userId,
    req.user!.role,
    req.user!.roles,
    Boolean(req.user!.canViewTeamBucket),
  );

  res.json({
    success: true,
    data: result,
  });
});