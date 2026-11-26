import { Router } from 'express';
import { PromotionController } from '../controllers/promotion.controller';
import { authMiddleware, requireTeacher } from '../middleware/auth.middleware';
import { uploadStudentList } from '../middleware/upload.middleware';
import { validatePromotion } from '../middleware/validation.middleware';

const router = Router();
const controller = new PromotionController();

router.use(authMiddleware, requireTeacher);

router.get('/my', controller.listMine);
router.post('/', validatePromotion(false), controller.create);
router.put('/:id', validatePromotion(true), controller.update);
router.delete('/:id', controller.remove);
router.post('/:id/students', controller.addStudents);
router.post('/:id/students/import', uploadStudentList.single('file'), controller.importStudents);
router.delete('/:id/students/:studentId', controller.removeStudent);

export default router;
