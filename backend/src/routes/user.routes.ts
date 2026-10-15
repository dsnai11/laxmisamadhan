import { Router } from 'express';
import { authenticate, requireRole } from '@middleware/auth.middleware';
import { validateBody, validateQuery, validateParams } from '@middleware/validation.middleware';
import * as userController from '@controllers/user.controller';
import * as validators from '@validators/user.validator';

const router = Router();

router.use(authenticate);
router.use(requireRole('SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD', 'TEAM_LEAD'));

router.get('/', validateQuery(validators.userQuerySchema), userController.getUsers);
router.get('/stats', userController.getUserStats);
router.get('/search', userController.searchUsers);
router.get('/subordinates', userController.getSubordinates);
router.get('/profile', userController.getProfile);
router.patch('/profile', validateBody(validators.updateUserSchema), userController.updateProfile);

router.post('/', validateBody(validators.createUserSchema), userController.createUser);
router.post('/bulk-create', requireRole('SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD'), validateBody(validators.bulkCreateUserSchema), userController.bulkCreateUsers);
router.post('/bulk', requireRole('SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD'), validateBody(validators.bulkUserActionSchema), userController.bulkUserAction);

router.get('/:id', userController.getUserById);
router.patch('/:id', validateBody(validators.updateUserSchema), userController.updateUser);
router.patch('/:id/role', validateBody(validators.updateUserRoleSchema), userController.updateUserRole);
router.post('/:id/reset-password', validateBody(validators.adminResetPasswordSchema), userController.resetUserPassword);
router.patch('/:id/status', validateBody(validators.updateUserStatusSchema), userController.updateUserStatus);
router.delete('/:id', requireRole('SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD'), userController.deleteUser);

export default router;