import { Request, Response } from 'express';
import { asyncHandler } from '@middleware/error.middleware';
import { AppError } from '@middleware/error.middleware';
import slaService from '@services/sla.service';
import { AuthenticatedRequest } from '@middleware/auth.middleware';
import { TicketPriority, TicketCategory } from '@prisma/client';

export const createPolicy = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (['DEPARTMENT_HEAD', 'TEAM_LEAD'].includes(req.user!.role)) {
    if (!req.user!.departmentId) {
      throw new AppError('User is not assigned to any department', 400, 'BAD_REQUEST');
    }
    req.body.departmentId = req.user!.departmentId;
  }

  const policy = await slaService.createPolicy(req.body, req.user!.userId);

  res.status(201).json({
    success: true,
    message: 'SLA policy created successfully',
    data: policy,
  });
});

export const getPolicies = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { departmentId } = req.query;
  const filterDept = ['DEPARTMENT_HEAD', 'TEAM_LEAD'].includes(req.user!.role) ? (req.user!.departmentId || undefined) : (departmentId as string | undefined);
  
  const policies = await slaService.getPolicies(filterDept);

  res.json({
    success: true,
    data: policies,
  });
});

export const getPolicyById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const policy = await slaService.getPolicyById(req.params.id);

  res.json({
    success: true,
    data: policy,
  });
});

export const updatePolicy = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (['DEPARTMENT_HEAD', 'TEAM_LEAD'].includes(req.user!.role)) {
    const existing = await slaService.getPolicyById(req.params.id);
    if (existing.departmentId !== req.user!.departmentId) {
      throw new AppError('You can only modify SLA policies for your own department', 403, 'FORBIDDEN');
    }
    req.body.departmentId = req.user!.departmentId;
  }

  const policy = await slaService.updatePolicy(req.params.id, req.body, req.user!.userId);

  res.json({
    success: true,
    message: 'SLA policy updated successfully',
    data: policy,
  });
});

export const deletePolicy = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (['DEPARTMENT_HEAD', 'TEAM_LEAD'].includes(req.user!.role)) {
    const existing = await slaService.getPolicyById(req.params.id);
    if (existing.departmentId !== req.user!.departmentId) {
      throw new AppError('You can only delete SLA policies for your own department', 403, 'FORBIDDEN');
    }
  }

  await slaService.deletePolicy(req.params.id, req.user!.userId);

  res.json({
    success: true,
    message: 'SLA policy deleted successfully',
  });
});

export const getSLACompliance = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { departmentId, dateFrom, dateTo } = req.query;
  
  const compliance = await slaService.calculateSLACompliance(
    departmentId as string,
    dateFrom ? new Date(dateFrom as string) : undefined,
    dateTo ? new Date(dateTo as string) : undefined
  );

  res.json({
    success: true,
    data: compliance,
  });
});

export const getSLAReport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { departmentId, dateFrom, dateTo } = req.query;
  
  const report = await slaService.getSLAReport(
    departmentId as string,
    dateFrom ? new Date(dateFrom as string) : undefined,
    dateTo ? new Date(dateTo as string) : undefined
  );

  res.json({
    success: true,
    data: report,
  });
});

export const checkSLATimers = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await slaService.checkSLATimers();

  res.json({
    success: true,
    message: 'SLA timers checked successfully',
  });
});