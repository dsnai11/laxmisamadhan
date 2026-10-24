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
// Team bucket — visible to admin, dept head, and team lead (ownership enforced in service)
router.get('/:id/teams/:teamId/bucket', requireRole('SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD', 'TEAM_LEAD', 'AGENT'), departmentController.getTeamBucket);

export default router;