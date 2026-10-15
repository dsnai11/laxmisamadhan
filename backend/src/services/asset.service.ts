import { prisma } from '@config/prisma';
import { createLogger } from '@utils/logger';
import { logActivity } from '@middleware/audit.middleware';
import { AssetType, Prisma } from '@prisma/client';

const logger = createLogger('asset-service');

interface AssetData {
  assetTag: string;
  name: string;
  type: AssetType;
  serialNumber?: string;
  model?: string;
  manufacturer?: string;
  departmentId: string;
  assignedToId?: string | null;
  location?: string;
  purchaseDate?: Date;
  warrantyExpiry?: Date;
  value?: number;
  currency?: string;
  specifications?: Record<string, any>;
}

interface UpdateAssetData extends Partial<AssetData> {}

class AssetService {
  async createAsset(data: AssetData, createdById: string): Promise<any> {
    const existingAsset = await prisma.asset.findUnique({ where: { assetTag: data.assetTag } });
    if (existingAsset) throw new Error('Asset tag already exists');

    const department = await prisma.department.findUnique({ where: { id: data.departmentId } });
    if (!department) throw new Error('Department not found');

    if (data.assignedToId) {
      const user = await prisma.user.findUnique({ where: { id: data.assignedToId } });
      if (!user) throw new Error('Assigned user not found');
      if (user.departmentId !== data.departmentId) throw new Error('User must belong to the same department');
    }

    const asset = await prisma.asset.create({
      data: {
        assetTag: data.assetTag,
        name: data.name,
        type: data.type,
        serialNumber: data.serialNumber,
        model: data.model,
        manufacturer: data.manufacturer,
        departmentId: data.departmentId,
        assignedToId: data.assignedToId,
        location: data.location,
        purchaseDate: data.purchaseDate,
        warrantyExpiry: data.warrantyExpiry,
        value: data.value,
        currency: data.currency || 'USD',
        specifications: data.specifications,
      },
      include: {
        department: { select: { id: true, name: true, type: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    await logActivity(createdById, 'ASSET_CREATED', `Created asset ${asset.assetTag}`, undefined, { assetId: asset.id, assetTag: asset.assetTag });

    return asset;
  }

  async getAssets(params: { page: number; limit: number; sortBy: string; sortOrder: 'asc' | 'desc'; type?: AssetType; status?: string; departmentId?: string; assignedToId?: string; search?: string }): Promise<{ assets: any[]; total: number; page: number; totalPages: number }> {
    const where: Prisma.AssetWhereInput = {};
    if (params.type) where.type = params.type;
    if (params.status) where.status = params.status;
    if (params.departmentId) where.departmentId = params.departmentId;
    if (params.assignedToId) where.assignedToId = params.assignedToId;
    if (params.search) {
      where.OR = [
        { assetTag: { contains: params.search, mode: 'insensitive' } },
        { name: { contains: params.search, mode: 'insensitive' } },
        { serialNumber: { contains: params.search, mode: 'insensitive' } },
        { model: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const orderBy: Prisma.AssetOrderByWithRelationInput = { [params.sortBy]: params.sortOrder };

    const [assets, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        orderBy,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        include: {
          department: { select: { id: true, name: true, type: true, color: true } },
          assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
          _count: { select: { tickets: true } },
        },
      }),
      prisma.asset.count({ where }),
    ]);

    return { assets, total, page: params.page, totalPages: Math.ceil(total / params.limit) };
  }

  async getAssetById(id: string): Promise<any> {
    const asset = await prisma.asset.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, name: true, type: true, color: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        tickets: {
          select: { id: true, ticketNumber: true, title: true, status: true, priority: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!asset) throw new Error('Asset not found');
    return asset;
  }

  async updateAsset(id: string, data: UpdateAssetData, updatedById: string): Promise<any> {
    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset) throw new Error('Asset not found');

    if (data.assetTag && data.assetTag !== asset.assetTag) {
      const existing = await prisma.asset.findUnique({ where: { assetTag: data.assetTag } });
      if (existing) throw new Error('Asset tag already exists');
    }

    if (data.assignedToId !== undefined) {
      if (data.assignedToId) {
        const user = await prisma.user.findUnique({ where: { id: data.assignedToId } });
        if (!user) throw new Error('Assigned user not found');
        if (user.departmentId !== asset.departmentId) throw new Error('User must belong to the same department');
      }
    }

    const updates: Prisma.AssetUpdateInput = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) updates[key as keyof Prisma.AssetUpdateInput] = value;
    }

    const updatedAsset = await prisma.asset.update({
      where: { id },
      data: updates,
      include: {
        department: { select: { id: true, name: true, type: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    await logActivity(updatedById, 'ASSET_UPDATED', `Updated asset ${asset.assetTag}`, undefined, { assetId: id, changes: data });

    return updatedAsset;
  }

  async deleteAsset(id: string, deletedById: string): Promise<void> {
    const asset = await prisma.asset.findUnique({ where: { id }, include: { _count: { select: { tickets: true } } } });
    if (!asset) throw new Error('Asset not found');
    if (asset._count.tickets > 0) throw new Error('Cannot delete asset with associated tickets');

    await prisma.asset.delete({ where: { id } });
    await logActivity(deletedById, 'ASSET_DELETED', `Deleted asset ${asset.assetTag}`, undefined, { assetId: id, assetTag: asset.assetTag });
  }

  async assignAsset(assetId: string, userId: string | null, assignedById: string): Promise<any> {
    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) throw new Error('Asset not found');

    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new Error('User not found');
      if (user.departmentId !== asset.departmentId) throw new Error('User must belong to the same department');
    }

    const updatedAsset = await prisma.asset.update({
      where: { id: assetId },
      data: { assignedToId: userId, status: userId ? 'ASSIGNED' : 'AVAILABLE' },
      include: { assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });

    await logActivity(assignedById, 'ASSET_ASSIGNED', `Asset ${asset.assetTag} ${userId ? 'assigned' : 'unassigned'}`, undefined, { assetId, userId });

    return updatedAsset;
  }

  async getAssetStats(departmentId?: string): Promise<any> {
    const where: Prisma.AssetWhereInput = {};
    if (departmentId) where.departmentId = departmentId;

    const [byType, byStatus, warrantyExpiring, totalValue] = await Promise.all([
      prisma.asset.groupBy({ by: ['type'], where, _count: true }),
      prisma.asset.groupBy({ by: ['status'], where, _count: true }),
      prisma.asset.findMany({
        where: { ...where, warrantyExpiry: { lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), gt: new Date() } },
        select: { id: true, assetTag: true, name: true, warrantyExpiry: true, assignedTo: { select: { id: true, firstName: true, lastName: true } } },
      }),
      prisma.asset.aggregate({ where, _sum: { value: true } }),
    ]);

    return {
      byType: byType.map(t => ({ type: t.type, count: t._count })),
      byStatus: byStatus.map(s => ({ status: s.status, count: s._count })),
      warrantyExpiring,
      totalValue: totalValue._sum.value || 0,
      totalAssets: byStatus.reduce((sum, s) => sum + s._count, 0),
    };
  }

  async searchAssets(query: string, limit: number = 10): Promise<any[]> {
    return prisma.asset.findMany({
      where: {
        OR: [
          { assetTag: { contains: query, mode: 'insensitive' } },
          { name: { contains: query, mode: 'insensitive' } },
          { serialNumber: { contains: query, mode: 'insensitive' } },
        ],
        status: { not: 'RETIRED' },
      },
      take: limit,
      select: { id: true, assetTag: true, name: true, type: true, status: true, assignedTo: { select: { id: true, firstName: true, lastName: true } } },
    });
  }
}

export const assetService = new AssetService();
export default assetService;