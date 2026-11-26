import { Router } from 'express';
import { DefenseController } from '../controllers/defense.controller';
import { authMiddleware, requireTeacher } from '../middleware/auth.middleware';
import { validateDefenseOrder, validateDefenseSchedule } from '../middleware/validation.middleware';

const router = Router();
const controller = new DefenseController();

router.use(authMiddleware, requireTeacher);

router.post('/projects/:projectId/schedule', validateDefenseSchedule, controller.schedule);
router.put('/projects/:projectId/reorder', validateDefenseOrder, controller.reorder);
router.get('/projects/:projectId/schedule/pdf', controller.schedulePdf);
router.get('/projects/:projectId/attendance/pdf', controller.attendancePdf);

export default router;
