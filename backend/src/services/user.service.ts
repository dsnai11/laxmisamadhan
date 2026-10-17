import { prisma } from '@config/prisma';
import { createLogger } from '@utils/logger';
import { hashPassword, generateToken } from '@utils/encryption';
import { logActivity } from '@middleware/audit.middleware';
import emailService from './email.service';
import config from '@config/index';
import { UserRole, UserStatus, Prisma } from '@prisma/client';
import { getPrimaryRole } from '@utils/userAccess';

const logger = createLogger('user-service');

interface CreateUserData {
  email: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  mobile?: string;
  employeeId?: string;
  jobTitle?: string;
  desginations?: string;
  designations?: string;
  departmentName?: string;
  departmentRaiserName?: string;
  reportingManagerName?: string;
  role?: any;
  roles?: UserRole[];
  status?: UserStatus;
  departmentId?: string;
  managerId?: string;
  sendWelcomeEmail?: boolean;
  temporaryPassword?: string;
}

interface UpdateUserData {
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  mobile?: string | null;
  employeeId?: string | null;
  jobTitle?: string | null;
  site?: string | null;
  reportingManagerName?: string | null;
  departmentRaiserName?: string | null;
  role?: UserRole;
  roles?: UserRole[];
  status?: UserStatus;
  departmentId?: string | null;
  managerId?: string | null;
  avatar?: string | null;
}

interface UserQueryParams {
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  search?: string;
  role?: UserRole;
  status?: UserStatus;
  departmentId?: string;
  managerId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

class UserService {
  async createUser(data: CreateUserData, createdById?: string): Promise<any> {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase().trim() },
    });

    if (existingUser) {
      throw new Error(`Email ${data.email} is already registered`);
    }

    let password = data.temporaryPassword || generateToken(12);
    const passwordHash = await hashPassword(password);

    let firstName = (data.firstName || '').trim();
    let lastName = (data.lastName || '').trim();
    if (!lastName && firstName.includes(' ')) {
      const parts = firstName.split(/\s+/);
      firstName = parts[0];
      lastName = parts.slice(1).join(' ');
    }
    if (!lastName) {
      lastName = '-';
    }

    // Resolve Department: by ID or by Name
    let departmentId = data.departmentId || null;
    if (!departmentId && data.departmentName && data.departmentName.trim()) {
      const dName = data.departmentName.trim();
      let dept = await prisma.department.findFirst({
        where: { name: { equals: dName, mode: 'insensitive' } },
      });
      if (!dept) {
        dept = await prisma.department.create({
          data: { name: dName },
        });
      }
      departmentId = dept.id;
    }

    const jobTitle = (data.jobTitle || data.designations || data.desginations || '').trim() || null;
    const departmentRaiserName = (data.departmentRaiserName || '').trim() || null;
    const reportingManagerName = (data.reportingManagerName || departmentRaiserName || '').trim() || null;

    let roles: UserRole[] = [];
    const validRoles = Object.values(UserRole);
    if (data.roles && data.roles.length > 0) {
      roles = Array.from(new Set(data.roles));
    } else if (data.role) {
      const formatted = String(data.role).trim().toUpperCase().replace(/[\s-]+/g, '_') as UserRole;
      roles = validRoles.includes(formatted) ? [formatted] : [UserRole.RAISER];
    } else {
      roles = [UserRole.RAISER];
    }
    const primaryRole = getPrimaryRole(roles);

    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase().trim(),
        passwordHash,
        firstName,
        lastName,
        phone: data.phone?.trim() || null,
        mobile: data.mobile?.trim() || null,
        employeeId: data.employeeId?.trim() || null,
        jobTitle,
        departmentRaiserName,
        reportingManagerName,
        role: primaryRole,
        roles,
        status: data.status || UserStatus.ACTIVE,
        departmentId,
        managerId: data.managerId,
        createdById,
        lastPasswordChange: new Date(),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        mobile: true,
        employeeId: true,
        jobTitle: true,
        departmentRaiserName: true,
        reportingManagerName: true,
        role: true,
        roles: true,
        status: true,
        departmentId: true,
        managerId: true,
        avatar: true,
        mfaEnabled: true,
        createdAt: true,
        department: { select: { id: true, name: true, type: true } },
        manager: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    await logActivity(createdById || 'system', 'USER_CREATED', `Created user ${user.email}`, undefined, { userId: user.id, role: user.role });

    if (data.sendWelcomeEmail !== false) {
      await emailService.sendWelcomeEmail(user.email, user.firstName, config.frontendUrl, data.temporaryPassword ? password : undefined);
    }

    logger.info('User created', { userId: user.id, email: user.email, role: user.role });

    return { ...user, temporaryPassword: data.temporaryPassword ? password : undefined };
  }

  async bulkCreateUsers(usersData: CreateUserData[], createdById: string): Promise<{ success: number; failed: number; users: any[]; errors: any[] }> {
    const results = { success: 0, failed: 0, users: [] as any[], errors: [] as any[] };

    for (const userData of usersData) {
      try {
        const user = await this.createUser(userData, createdById);
        results.success++;
        results.users.push(user);
      } catch (error) {
        results.failed++;
        results.errors.push({
          email: userData.email,
          name: `${userData.firstName} ${userData.lastName || ''}`.trim(),
          error: error instanceof Error ? error.message : 'Failed to create user',
        });
      }
    }

    return results;
  }

  async getUsers(params: UserQueryParams): Promise<{ users: any[]; total: number; page: number; totalPages: number }> {
    const where = this.buildUserWhereClause(params);
    const orderBy = this.buildOrderBy(params.sortBy, params.sortOrder);

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          mobile: true,
          employeeId: true,
          jobTitle: true,
          departmentRaiserName: true,
          reportingManagerName: true,
          role: true,
          roles: true,
          status: true,
          departmentId: true,
          managerId: true,
          avatar: true,
          mfaEnabled: true,
          lastLoginAt: true,
          createdAt: true,
          department: { select: { id: true, name: true, type: true, color: true } },
          manager: { select: { id: true, firstName: true, lastName: true, email: true } },
          _count: { select: { ticketsRaised: true, ticketsAssigned: true, subordinates: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users,
      total,
      page: params.page,
      totalPages: Math.ceil(total / params.limit),
    };
  }

  async getUserById(id: string): Promise<any> {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        mobile: true,
        employeeId: true,
        jobTitle: true,
        site: true,
        reportingManagerName: true,
        departmentRaiserName: true,
        role: true,
        roles: true,
        status: true,
        departmentId: true,
        managerId: true,
        avatar: true,
        mfaEnabled: true,
        emailVerified: true,
        lastLoginAt: true,
        lastPasswordChange: true,
        createdAt: true,
        updatedAt: true,
        department: { select: { id: true, name: true, type: true, color: true } },
        manager: { select: { id: true, firstName: true, lastName: true, email: true } },
        subordinates: { select: { id: true, firstName: true, lastName: true, email: true, role: true, roles: true } },
        _count: { select: { ticketsRaised: true, ticketsAssigned: true, comments: true, notifications: { where: { isRead: false } } } },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  async updateUser(id: string, data: UpdateUserData, updatedById: string): Promise<any> {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new Error('User not found');

    if (data.email !== undefined && data.email.trim() !== '') {
      const normalizedEmail = data.email.trim().toLowerCase();
      if (normalizedEmail !== user.email.toLowerCase()) {
        const existing = await prisma.user.findFirst({
          where: {
            email: normalizedEmail,
            id: { not: id },
          },
        });
        if (existing) {
          throw new Error('Email address is already in use by another user');
        }
        data.email = normalizedEmail;
      }
    }

    if (data.roles !== undefined && data.roles.length > 0) {
      const roles = Array.from(new Set(data.roles));
      data.roles = roles;
      data.role = getPrimaryRole(roles);
    } else if (data.role !== undefined) {
      data.roles = [data.role];
    }

    const oldValues: Record<string, any> = {};
    const updates: Prisma.UserUpdateInput = {};

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && (user as any)[key] !== value) {
        oldValues[key] = (user as any)[key];
        updates[key as keyof Prisma.UserUpdateInput] = value;
      }
    }

    if (Object.keys(updates).length === 0) return user;

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updates,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        mobile: true,
        employeeId: true,
        jobTitle: true,
        site: true,
        reportingManagerName: true,
        departmentRaiserName: true,
        role: true,
        roles: true,
        status: true,
        departmentId: true,
        managerId: true,
        avatar: true,
        mfaEnabled: true,
        department: { select: { id: true, name: true, type: true } },
        manager: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    for (const [field, oldValue] of Object.entries(oldValues)) {
      await logActivity(updatedById, 'USER_UPDATED', `Updated ${field}`, undefined, { 
        targetUserId: id, 
        field, 
        oldValue, 
        newValue: data[field as keyof UpdateUserData] 
      });
    }

    return updatedUser;
  }

  async updateUserRole(id: string, roleOrRoles: UserRole | UserRole[], updatedById: string): Promise<any> {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new Error('User not found');

    const rawRoles = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles];
    const roles = Array.from(new Set(rawRoles.length > 0 ? rawRoles : [UserRole.RAISER]));
    const primaryRole = getPrimaryRole(roles);

    if (user.role === UserRole.SUPER_ADMIN && !roles.includes(UserRole.SUPER_ADMIN)) {
      const superAdminCount = await prisma.user.count({ where: { role: UserRole.SUPER_ADMIN } });
      if (superAdminCount <= 1) {
        throw new Error('Cannot demote the last super admin');
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        role: primaryRole,
        roles,
      },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, roles: true },
    });

    await logActivity(updatedById, 'USER_ROLE_CHANGED', `Changed roles to ${roles.join(', ')}`, undefined, { targetUserId: id, oldRole: user.role, newRoles: roles });

    return updatedUser;
  }

  async updateUserStatus(id: string, status: UserStatus, updatedById: string, reason?: string): Promise<any> {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new Error('User not found');

    if (user.id === updatedById && status !== UserStatus.ACTIVE) {
      throw new Error('Cannot change your own status');
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { status },
      select: { id: true, email: true, firstName: true, lastName: true, status: true },
    });

    await prisma.session.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await logActivity(updatedById, 'USER_STATUS_CHANGED', `Changed status from ${user.status} to ${status}`, undefined, { targetUserId: id, oldStatus: user.status, newStatus: status, reason });

    return updatedUser;
  }

  async resetPassword(id: string, password: string, resetById: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new Error('User not found');

    await prisma.user.update({
      where: { id },
      data: {
        passwordHash: await hashPassword(password),
        lastPasswordChange: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });
    await prisma.session.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    await logActivity(resetById, 'USER_PASSWORD_RESET', `Reset password for ${user.email}`, undefined, { targetUserId: id });
  }

  async deleteUser(id: string, deletedById: string): Promise<void> {
    if (id === deletedById) {
      throw new Error('You cannot delete your own account');
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new Error('User not found');

    if (user.role === UserRole.SUPER_ADMIN) {
      const superAdminCount = await prisma.user.count({ where: { role: UserRole.SUPER_ADMIN } });
      if (superAdminCount <= 1) {
        throw new Error('Cannot delete the last super admin');
      }
    }

    // 1. Sessions and Notifications
    await prisma.session.deleteMany({ where: { userId: id } });
    await prisma.notification.deleteMany({ where: { userId: id } });

    // 2. Watchers and Custom Fields
    await prisma.ticketWatcher.deleteMany({ where: { userId: id } });
    await prisma.customFieldValue.deleteMany({ where: { userId: id } });

    // 3. User hierarchies and Head/Lead roles
    await prisma.user.updateMany({ where: { managerId: id }, data: { managerId: null } });
    await prisma.user.updateMany({ where: { createdById: id }, data: { createdById: null } });
    await prisma.department.updateMany({ where: { headId: id }, data: { headId: null } });
    await prisma.team.updateMany({ where: { leadId: id }, data: { leadId: null } });
    await prisma.user.update({ where: { id }, data: { teamMemberships: { set: [] } } });

    // 4. Assets and SLA
    await prisma.asset.updateMany({ where: { assignedToId: id }, data: { assignedToId: null } });
    await prisma.sLAPolicy.updateMany({ where: { createdById: id }, data: { createdById: deletedById } });
    await prisma.sLAEvent.updateMany({ where: { acknowledgedById: id }, data: { acknowledgedById: null } });

    // 5. Knowledge Base articles and reviews
    await prisma.knowledgeArticle.updateMany({ where: { authorId: id }, data: { authorId: deletedById } });
    await prisma.knowledgeArticleReview.deleteMany({ where: { userId: id } });

    // 6. Tickets, comments, updates, attachments
    await prisma.ticket.updateMany({ where: { assignedToId: id }, data: { assignedToId: null } });
    await prisma.ticket.updateMany({ where: { assignedById: id }, data: { assignedById: null } });
    await prisma.ticket.updateMany({ where: { raisedById: id }, data: { raisedById: deletedById } });
    await prisma.comment.updateMany({ where: { userId: id }, data: { userId: deletedById } });
    await prisma.ticketUpdate.updateMany({ where: { userId: id }, data: { userId: deletedById } });
    await prisma.attachment.updateMany({ where: { userId: id }, data: { userId: deletedById } });

    // 7. Approvals and Activity Logs
    await prisma.approval.deleteMany({ where: { OR: [{ approverId: id }, { requesterId: id }] } });
    await prisma.activityLog.deleteMany({ where: { userId: id } });

    // 8. Delete user
    await prisma.user.delete({ where: { id } });
    await logActivity(deletedById, 'USER_DELETED', `Deleted user ${user.email}`, undefined, { targetUserId: id, email: user.email });
  }

  async bulkAction(userIds: string[], action: string, data: Record<string, any>, performedById: string): Promise<{ success: number; failed: number; errors: any[] }> {
    const results = { success: 0, failed: 0, errors: [] as any[] };

    for (const userId of userIds) {
      try {
        if (userId === performedById && ['deactivate', 'suspend', 'delete', 'changeRole'].includes(action)) {
          results.failed++;
          results.errors.push({ userId, error: 'Cannot perform this action on yourself' });
          continue;
        }

        switch (action) {
          case 'activate':
            await this.updateUserStatus(userId, UserStatus.ACTIVE, performedById);
            break;
          case 'deactivate':
            await this.updateUserStatus(userId, UserStatus.INACTIVE, performedById);
            break;
          case 'suspend':
            await this.updateUserStatus(userId, UserStatus.SUSPENDED, performedById);
            break;
          case 'changeRole':
            await this.updateUserRole(userId, data.role, performedById);
            break;
          case 'changeDepartment':
            await this.updateUser(userId, { departmentId: data.departmentId }, performedById);
            break;
          case 'delete':
            await this.deleteUser(userId, performedById);
            break;
        }

        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({ userId, error: error instanceof Error ? error.message : 'Unknown error' });
      }
    }

    return results;
  }

  async getUserStats(): Promise<any> {
    const [total, byRole, byStatus, byDepartment, recentLogins] = await Promise.all([
      prisma.user.count(),
      prisma.user.groupBy({ by: ['role'], _count: true }),
      prisma.user.groupBy({ by: ['status'], _count: true }),
      prisma.user.groupBy({ by: ['departmentId'], _count: true, where: { departmentId: { not: null } } }),
      prisma.user.findMany({
        where: { lastLoginAt: { not: null } },
        orderBy: { lastLoginAt: 'desc' },
        take: 10,
        select: { id: true, firstName: true, lastName: true, email: true, lastLoginAt: true },
      }),
    ]);

    const departmentIds = byDepartment.map(d => d.departmentId).filter(Boolean) as string[];
    const departments = await prisma.department.findMany({
      where: { id: { in: departmentIds } },
      select: { id: true, name: true },
    });

    return {
      total,
      byRole: byRole.map(r => ({ role: r.role, count: r._count })),
      byStatus: byStatus.map(s => ({ status: s.status, count: s._count })),
      byDepartment: byDepartment.map(d => ({
        department: departments.find(dep => dep.id === d.departmentId)?.name || 'Unknown',
        count: d._count,
      })),
      recentLogins,
    };
  }

  async getSubordinates(managerId: string): Promise<any[]> {
    return prisma.user.findMany({
      where: { managerId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        department: { select: { id: true, name: true } },
      },
    });
  }

  async searchUsers(query: string, limit: number = 10): Promise<any[]> {
    return prisma.user.findMany({
      where: {
        OR: [
          { firstName: { contains: query, mode: 'insensitive' } },
          { lastName: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } },
        ],
        status: UserStatus.ACTIVE,
      },
      take: limit,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        department: { select: { id: true, name: true, color: true } },
        avatar: true,
      },
    });
  }

  private buildUserWhereClause(params: UserQueryParams): Prisma.UserWhereInput {
    const where: Prisma.UserWhereInput = {};

    if (params.role) {
      if (typeof params.role === 'string' && params.role.includes(',')) {
        const roles = params.role.split(',').map((r) => r.trim()) as UserRole[];
        where.OR = [
          { role: { in: roles } },
          { roles: { hasSome: roles } },
        ];
      } else {
        const r = params.role as UserRole;
        where.OR = [
          { role: r },
          { roles: { has: r } },
        ];
      }
    }
    if (params.status) where.status = params.status;
    if (params.departmentId) where.departmentId = params.departmentId;
    if (params.managerId) where.managerId = params.managerId;

    if (params.search) {
      where.OR = [
        { firstName: { contains: params.search, mode: 'insensitive' } },
        { lastName: { contains: params.search, mode: 'insensitive' } },
        { email: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    if (params.dateFrom || params.dateTo) {
      where.createdAt = {};
      if (params.dateFrom) where.createdAt.gte = params.dateFrom;
      if (params.dateTo) where.createdAt.lte = params.dateTo;
    }

    return where;
  }

  private buildOrderBy(sortBy: string, sortOrder: 'asc' | 'desc'): Prisma.UserOrderByWithRelationInput {
    const validSortFields = ['createdAt', 'updatedAt', 'firstName', 'lastName', 'email', 'role', 'status'];
    const field = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    return { [field]: sortOrder };
  }
}

export const userService = new UserService();
export default userService;