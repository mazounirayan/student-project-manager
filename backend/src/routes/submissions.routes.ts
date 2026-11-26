import { Router } from 'express';
import { DeliverableController } from '../controllers/deliverable.controller';
import { authMiddleware, requireTeacher } from '../middleware/auth.middleware';

const router = Router();
const controller = new DeliverableController();

router.get('/:submissionId/similarity', authMiddleware, requireTeacher, controller.getSimilarity);

export default router;
