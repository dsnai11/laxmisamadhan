import { Router } from 'express';
import { authenticate, requireRole } from '@middleware/auth.middleware';
import { validateBody, validateQuery, validateParams } from '@middleware/validation.middleware';
import * as departmentController from '@controllers/department.controller';
import * as validators from '@validators/user.validator';

const router = Router();

router.use(authenticate);

router.get('/', departmentController.getDepartments);
router.get('/tree', departmentController.getDepartmentTree);

router.post('/', requireRole('SUPER_ADMIN', 'ADMIN'), validateBody(validators.departmentSchema), departmentController.createDepartment);

router.get('/:id', departmentController.getDepartmentById);
router.patch('/:id', requireRole('SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD'), validateBody(validators.updateDepartmentSchema), departmentController.updateDepartment);
router.delete('/:id', requireRole('SUPER_ADMIN', 'ADMIN'), departmentController.deleteDepartment);

router.patch('/:id/head', requireRole('SUPER_ADMIN', 'ADMIN'), departmentController.assignHead);
router.get('/:id/stats', departmentController.getDepartmentStats);

router.get('/:id/categories', departmentController.getCategoryConfigs);
router.post('/:id/categories', requireRole('SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD', 'TEAM_LEAD'), departmentController.createCategoryConfig);
router.patch('/:id/categories/:category', requireRole('SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD', 'TEAM_LEAD'), departmentController.updateCategoryConfig);
router.delete('/:id/categories/:category', requireRole('SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD', 'TEAM_LEAD'), departmentController.deleteCategoryConfig);

router.get('/:id/teams', departmentController.getTeams);
router.post('/:id/teams', requireRole('SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD', 'TEAM_LEAD'), validateBody(validators.teamSchema), departmentController.createTeam);
// TEAM_LEAD can update their own team (service layer enforces ownership)
router.patch('/:id/teams/:teamId', requireRole('SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD', 'TEAM_LEAD'), validateBody(validators.updateTeamSchema), departmentController.updateTeam);
router.delete('/:id/teams/:teamId', requireRole('SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD'), departmentController.deleteTeam);
const requireTeamBucketAccess = (req: any, res: any, next: any) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Authentication required', code: 'UNAUTHORIZED' });
  }
  const userRoles = req.user.roles && req.user.roles.length > 0 ? req.user.roles : [req.user.role];
  const isLeadershipOrLead = userRoles.some((r: string) => ['SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD', 'TEAM_LEAD'].includes(r));
  const hasBucketFlag = Boolean(req.user.canViewTeamBucket);

  if (isLeadershipOrLead || hasBucketFlag) {
    return next();
  }

  return res.status(403).json({
    success: false,
    error: 'Insufficient permissions: You do not have permission to access the team bucket',
    code: 'FORBIDDEN',
  });
};

// Team bucket — visible to admin, dept head, team lead, or explicitly permitted agents
router.get('/:id/teams/:teamId/bucket', requireTeamBucketAccess, departmentController.getTeamBucket);

export default router;