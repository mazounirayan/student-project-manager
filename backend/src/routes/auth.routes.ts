import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import {
  validateForgotPassword, validateLogin, validateOAuthToken, validateRefreshToken,
  validateRegister, validateResetPassword,
} from '../middleware/validation.middleware';

const router = Router();
const controller = new AuthController();

const credentialsLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives, réessayez dans 15 minutes' },
});

router.post('/login', credentialsLimiter, validateLogin, controller.login);
router.post('/register', credentialsLimiter, validateRegister, controller.registerStudent);
router.post('/forgot-password', credentialsLimiter, validateForgotPassword, controller.forgotPassword);
router.post('/reset-password', credentialsLimiter, validateResetPassword, controller.resetPassword);
router.post('/refresh', validateRefreshToken, controller.refreshToken);
router.post('/oauth/google', credentialsLimiter, validateOAuthToken, controller.googleOAuth);
router.post('/oauth/microsoft', credentialsLimiter, validateOAuthToken, controller.microsoftOAuth);

router.get('/verify', authMiddleware, controller.verifyToken);
router.get('/me', authMiddleware, controller.getCurrentUser);
router.post('/logout', authMiddleware, controller.logout);

export default router;
