import { Request, Response } from 'express';
import { asyncHandler } from '@middleware/error.middleware';
import { AppError } from '@middleware/error.middleware';
import reportService from '@services/report.service';
import { AuthenticatedRequest } from '@middleware/auth.middleware';
import { UserRole } from '@prisma/client';

export const getDashboardStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const params = {
    departmentId: req.query.departmentId as string,
    dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
    dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
    userId: req.user!.userId,
    userRole: req.user!.role,
    userDepartmentId: req.user!.departmentId,
  };

  const stats = await reportService.getDashboardStats(params);

  res.json({
    success: true,
    data: stats,
  });
});

export const getAgentPerformance = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userRoles = req.user!.roles && req.user!.roles.length > 0 ? req.user!.roles : [req.user!.role];
  if (!userRoles.some(r => ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD', 'TEAM_LEAD'].includes(r))) {
    throw new AppError('Insufficient permissions', 403, 'FORBIDDEN');
  }

  const params = {
    departmentId: req.query.departmentId as string,
    dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
    dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
    userId: req.user!.userId,
    userRole: req.user!.role,
  };

  const performance = await reportService.getAgentPerformance(params);

  res.json({
    success: true,
    data: performance,
  });
});

export const getDepartmentReport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userRoles = req.user!.roles && req.user!.roles.length > 0 ? req.user!.roles : [req.user!.role];
  if (!userRoles.some(r => ['SUPER_ADMIN', 'ADMIN'].includes(r))) {
    throw new AppError('Insufficient permissions', 403, 'FORBIDDEN');
  }

  const params = {
    departmentId: req.query.departmentId as string,
    dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
    dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
    userId: req.user!.userId,
    userRole: req.user!.role,
  };

  const report = await reportService.getDepartmentReport(params);

  res.json({
    success: true,
    data: report,
  });
});

export const getSLAReport = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const params = {
    departmentId: req.query.departmentId as string,
    dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
    dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
    userId: req.user!.userId,
    userRole: req.user!.role,
  };

  const report = await reportService.getSLAReport(params);

  res.json({
    success: true,
    data: report,
  });
});

export const getTicketTrend = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const params = {
    departmentId: req.query.departmentId as string,
    dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
    dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
    userId: req.user!.userId,
    userRole: req.user!.role,
  };

  const days = parseInt(req.query.days as string) || 30;
  const trend = await reportService.getTicketVolumeTrend(params, days);

  res.json({
    success: true,
    data: trend,
  });
});

export const exportTickets = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userRoles = req.user!.roles && req.user!.roles.length > 0 ? req.user!.roles : [req.user!.role];
  if (!userRoles.some(r => ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD'].includes(r))) {
    throw new AppError('Insufficient permissions', 403, 'FORBIDDEN');
  }

  const params = {
    departmentId: req.query.departmentId as string,
    dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
    dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined,
    userId: req.user!.userId,
    userRole: req.user!.role,
  };

  const format = (req.query.format as 'csv' | 'json') || 'csv';
  const data = await reportService.exportTickets(params, format);

  res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="tickets-export-${new Date().toISOString().split('T')[0]}.${format}"`);
  
  res.send(data);
});