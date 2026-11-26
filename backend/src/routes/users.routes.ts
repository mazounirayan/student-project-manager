import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { authMiddleware, requireTeacher } from '../middleware/auth.middleware';
import { validateProfileUpdate } from '../middleware/validation.middleware';

const router = Router();
const controller = new UserController();

router.use(authMiddleware);

router.get('/profile', controller.getProfile);
router.put('/profile', validateProfileUpdate, controller.updateProfile);

router.get('/search', requireTeacher, controller.search);
router.get('/students', requireTeacher, controller.listStudents);
router.get('/teachers', requireTeacher, controller.listTeachers);
router.put('/:id/deactivate', requireTeacher, controller.deactivate);
router.put('/:id/activate', requireTeacher, controller.activate);

export default router;
