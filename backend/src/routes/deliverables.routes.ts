import { Router } from 'express';
import { DeliverableController } from '../controllers/deliverable.controller';
import { authMiddleware, requireStudent, requireTeacher } from '../middleware/auth.middleware';
import { uploadArchive } from '../middleware/upload.middleware';
import { validateDeliverable, validateRule } from '../middleware/validation.middleware';

const router = Router();
const controller = new DeliverableController();

router.use(authMiddleware);

router.get('/projects/:projectId/deliverables', controller.listByProject);
router.get('/submissions/:submissionId/download', controller.download);

router.post('/', requireTeacher, validateDeliverable(false), controller.create);
router.put('/:id', requireTeacher, validateDeliverable(true), controller.update);
router.patch('/:id', requireTeacher, validateDeliverable(true), controller.update);
router.delete('/:id', requireTeacher, controller.remove);

router.post('/:id/rules', requireTeacher, validateRule(false), controller.addRule);
router.put('/:id/rules/:ruleId', requireTeacher, validateRule(true), controller.updateRule);
router.patch('/:id/rules/:ruleId', requireTeacher, validateRule(true), controller.updateRule);
router.delete('/:id/rules/:ruleId', requireTeacher, controller.removeRule);

router.get('/:id/submissions', requireTeacher, controller.listSubmissions);
router.get('/:id/submissions/:groupId', requireTeacher, controller.getGroupSubmission);
router.post('/:id/analyze-similarity', requireTeacher, controller.analyzeSimilarity);

router.post('/:id/validate', requireStudent, uploadArchive.single('file'), controller.validate);
router.post('/:id/submit', requireStudent, uploadArchive.single('file'), controller.submit);

export default router;
