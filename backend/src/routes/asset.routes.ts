import { Router } from 'express';
import { authenticate, requireRole } from '@middleware/auth.middleware';
import { validateBody, validateQuery, validateParams } from '@middleware/validation.middleware';
import * as assetController from '@controllers/asset.controller';
import * as validators from '@validators/user.validator';

const router = Router();

router.use(authenticate);

router.get('/', validateQuery(validators.assetQuerySchema), assetController.getAssets);

router.get('/stats', requireRole('SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD', 'TEAM_LEAD', 'AGENT'), assetController.getAssetStats);
router.get('/search', assetController.searchAssets);

router.post('/', requireRole('SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD'), validateBody(validators.assetSchema), assetController.createAsset);

router.get('/:id', assetController.getAssetById);
router.patch('/:id', requireRole('SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD'), validateBody(validators.updateAssetSchema), assetController.updateAsset);
router.delete('/:id', requireRole('SUPER_ADMIN', 'ADMIN'), assetController.deleteAsset);

router.post('/:id/assign', requireRole('SUPER_ADMIN', 'ADMIN', 'DEPARTMENT_HEAD', 'TEAM_LEAD'), validateBody(validators.assignAssetSchema), assetController.assignAsset);

export default router;