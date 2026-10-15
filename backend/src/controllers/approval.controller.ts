import { Request, Response } from 'express';
import { asyncHandler } from '@middleware/error.middleware';
import { AppError } from '@middleware/error.middleware';
import approvalService from '@services/approval.service';
import { AuthenticatedRequest } from '@middleware/auth.middleware';

export const createApproval = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const approval = await approvalService.createApproval(req.body, req.user!.userId);

  res.status(201).json({
    success: true,
    message: 'Approval requested successfully',
    data: approval,
  });
});

export const getApprovals = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const approvals = await approvalService.getApprovals(req.params.ticketId);

  res.json({
    success: true,
    data: approvals,
  });
});

export const getApprovalById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const approval = await approvalService.getApprovalById(req.params.id);

  res.json({
    success: true,
    data: approval,
  });
});

export const getPendingApprovals = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const params = {
    page: parseInt(req.query.page as string) || 1,
    limit: parseInt(req.query.limit as string) || 20,
  };

  const result = await approvalService.getPendingApprovals(req.user!.userId, params);

  res.json({
    success: true,
    data: result,
  });
});

export const respondToApproval = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { status, response } = req.body;
  
  const approval = await approvalService.respondToApproval(req.params.id, req.user!.userId, status, response);

  res.json({
    success: true,
    message: `Approval ${status.toLowerCase()} successfully`,
    data: approval,
  });
});

export const cancelApproval = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await approvalService.cancelApproval(req.params.id, req.user!.userId);

  res.json({
    success: true,
    message: 'Approval cancelled successfully',
  });
});