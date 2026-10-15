import { Router } from 'express';
import { authenticate, requireRole } from '@middleware/auth.middleware';
import { validateBody, validateQuery, validateParams } from '@middleware/validation.middleware';
import { authRateLimiter, strictRateLimiter } from '@middleware/rateLimit.middleware';
import * as authController from '@controllers/auth.controller';
import * as validators from '@validators/auth.validator';

const router = Router();

router.post('/register', authRateLimiter, validateBody(validators.registerSchema), authController.register);
router.post('/login', authRateLimiter, validateBody(validators.loginSchema), authController.login);
router.post('/refresh', validateBody(validators.refreshTokenSchema), authController.refresh);
router.post('/logout', authenticate, authController.logout);

router.post('/forgot-password', authRateLimiter, validateBody(validators.forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', authRateLimiter, validateBody(validators.resetPasswordSchema), authController.resetPassword);
router.post('/change-password', authenticate, validateBody(validators.changePasswordSchema), authController.changePassword);
router.post('/verify-email', validateBody(validators.verifyEmailSchema), authController.verifyEmail);

router.post('/mfa/setup', authenticate, strictRateLimiter, authController.setupMFA);
router.post('/mfa/verify', authenticate, validateBody(validators.mfaVerifySchema), authController.verifyMFA);
router.post('/mfa/disable', authenticate, validateBody(validators.mfaVerifySchema), authController.disableMFA);
router.post('/mfa/backup', authenticate, validateBody(validators.mfaVerifySchema), authController.verifyBackupCode);

router.get('/me', authenticate, authController.getMe);
router.patch('/profile', authenticate, validateBody(validators.updateProfileSchema), authController.updateProfile);

export default router;