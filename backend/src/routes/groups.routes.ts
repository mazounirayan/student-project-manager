import { Router } from 'express';
import { GroupController } from '../controllers/group.controller';
import { authMiddleware, requireStudent } from '../middleware/auth.middleware';

const router = Router();
const controller = new GroupController();

router.use(authMiddleware);

router.get('/project/:projectId/groups', controller.listByProject);
router.post('/:id/join', requireStudent, controller.join);

export default router;
