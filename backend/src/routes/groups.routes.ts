import { Router } from 'express';
import { GroupController } from '../controllers/group.controller';
import { authMiddleware, requireStudent, requireTeacher } from '../middleware/auth.middleware';

const router = Router();
const controller = new GroupController();

router.use(authMiddleware);

router.get('/project/:projectId/groups', controller.listByProject);
router.post('/project/:projectId', controller.create);
router.post('/:id/join', requireStudent, controller.join);
router.post('/:id/leave', requireStudent, controller.leave);
router.delete('/:id', requireTeacher, controller.remove);

export default router;
