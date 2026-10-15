import { Request, Response } from 'express';
import { asyncHandler } from '@middleware/error.middleware';
import { AppError } from '@middleware/error.middleware';
import assetService from '@services/asset.service';
import { AuthenticatedRequest } from '@middleware/auth.middleware';
import { AssetType } from '@prisma/client';

const STAFF_ROLES = ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD', 'TEAM_LEAD', 'AGENT'];

export const createAsset = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const asset = await assetService.createAsset(req.body, req.user!.userId);

  res.status(201).json({
    success: true,
    message: 'Asset created successfully',
    data: asset,
  });
});

export const getAssets = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const params = {
    page: parseInt(req.query.page as string) || 1,
    limit: parseInt(req.query.limit as string) || 20,
    sortBy: req.query.sortBy as string || 'createdAt',
    sortOrder: (req.query.sortOrder as 'asc' | 'desc') || 'desc',
    type: req.query.type as AssetType,
    status: req.query.status as string,
    departmentId: req.query.departmentId as string,
    assignedToId: STAFF_ROLES.includes(req.user!.role) ? (req.query.assignedToId as string) : req.user!.userId,
    search: req.query.search as string,
  };

  const result = await assetService.getAssets(params);

  res.json({
    success: true,
    data: result,
  });
});

export const getAssetById = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const asset = await assetService.getAssetById(req.params.id);

  if (!STAFF_ROLES.includes(req.user!.role) && (asset as any)?.assignedToId !== req.user!.userId) {
    throw new Error('Access denied');
  }

  res.json({
    success: true,
    data: asset,
  });
});

export const updateAsset = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const asset = await assetService.updateAsset(req.params.id, req.body, req.user!.userId);

  res.json({
    success: true,
    message: 'Asset updated successfully',
    data: asset,
  });
});

export const deleteAsset = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  await assetService.deleteAsset(req.params.id, req.user!.userId);

  res.json({
    success: true,
    message: 'Asset deleted successfully',
  });
});

export const assignAsset = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { userId } = req.body;
  
  const asset = await assetService.assignAsset(req.params.id, userId, req.user!.userId);

  res.json({
    success: true,
    message: userId ? 'Asset assigned successfully' : 'Asset unassigned successfully',
    data: asset,
  });
});

export const getAssetStats = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { departmentId } = req.query;
  
  const stats = await assetService.getAssetStats(departmentId as string);

  res.json({
    success: true,
    data: stats,
  });
});

export const searchAssets = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { q, limit } = req.query;
  
  const all = await assetService.searchAssets(q as string, parseInt(limit as string) || 10);
  const assets = STAFF_ROLES.includes(req.user!.role) ? all : all.filter((a: any) => a.assignedToId === req.user!.userId);

  res.json({
    success: true,
    data: assets,
  });
});