import { Router } from 'express';
import { ProjectController } from '../controllers/project.controller';
import { GroupController } from '../controllers/group.controller';
import { authMiddleware, requireTeacher } from '../middleware/auth.middleware';
import { validateGrouping, validateProject } from '../middleware/validation.middleware';

const router = Router();
const controller = new ProjectController();
const groupController = new GroupController();

router.use(authMiddleware);

router.get('/my', controller.listMine);
router.get('/:id', controller.getById);

router.post('/', requireTeacher, validateProject(false), controller.create);
router.put('/:id', requireTeacher, validateProject(true), controller.update);
router.delete('/:id', requireTeacher, controller.remove);
router.put('/:id/groups', requireTeacher, validateGrouping, groupController.saveGrouping);

export default router;
