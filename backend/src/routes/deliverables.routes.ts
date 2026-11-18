import { Router } from 'express';
import { DeliverableController } from '../controllers/deliverable.controller';
import { authMiddleware, requireTeacher, AuthenticatedRequest } from '../middleware/auth.middleware';
import { AppDataSource } from '../database/data-source';
import { DeliverableSubmission, Group } from '../entities/Entities';
import { parseRouteId } from '../utils/route-id';
import path from 'path';
import { validateCreateDeliverable } from '../middleware/validation.middleware';
import { uploadMiddleware } from '../middleware/upload.middleware';

const router = Router();
const deliverableController = new DeliverableController();

router.get('/submissions/:submissionId/download', authMiddleware, async (req: AuthenticatedRequest, res, next) => {
  try {
    const submission = await AppDataSource.getRepository(DeliverableSubmission).findOne({
      where: { id: parseRouteId(req.params.submissionId) },
      relations: ['group', 'group.members', 'deliverable', 'deliverable.project', 'deliverable.project.teacher'],
    });
    if (!submission?.filePath) return res.status(404).json({ error: 'Submission file not found' });
    const allowed = req.user?.role === 'teacher'
      ? submission.deliverable.project.teacher.id === req.user.id
      : submission.group.members.some(member => member.id === req.user?.id);
    if (!allowed) return res.status(403).json({ error: 'Access forbidden' });
    const root = path.resolve('uploads');
    const file = path.resolve(submission.filePath);
    const relative = path.relative(root, file);
    if (relative.startsWith('..') || path.isAbsolute(relative)) return res.status(403).json({ error: 'Invalid file location' });
    res.download(file, error => { if (error) next(error); });
  } catch (error) { next(error); }
});

// Routes pour les enseignants
router.post('/', authMiddleware, requireTeacher, validateCreateDeliverable, 
  deliverableController.createDeliverable.bind(deliverableController));
router.put('/:id', authMiddleware, requireTeacher, validateCreateDeliverable, 
  deliverableController.updateDeliverable.bind(deliverableController));
router.post('/:id/rules', authMiddleware, requireTeacher, 
  deliverableController.addValidationRule.bind(deliverableController));
router.get('/:id/submissions', authMiddleware, requireTeacher, 
  deliverableController.getSubmissions.bind(deliverableController));
router.get('/:id/summary', authMiddleware, requireTeacher, 
  deliverableController.getSubmissionSummary.bind(deliverableController));
router.post('/:id/analyze-similarity', authMiddleware, requireTeacher, 
  deliverableController.analyzeSimilarity.bind(deliverableController));
router.post('/:id/send-reminders', authMiddleware, requireTeacher, 
  deliverableController.sendDeadlineReminders.bind(deliverableController));

// Routes pour les étudiants
router.post('/:id/submit', authMiddleware, uploadMiddleware.single('file'),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const groupId = parseRouteId(req.body?.groupId);
      const group = groupId
        ? await AppDataSource.getRepository(Group).findOne({ where: { id: groupId }, relations: ['members'] })
        : null;
      if (!group) return res.status(404).json({ error: 'Groupe introuvable' });
      // Un étudiant ne peut soumettre que pour son propre groupe.
      const allowed = req.user?.role === 'student' && group.members.some(member => member.id === req.user?.id);
      if (!allowed) return res.status(403).json({ error: 'Soumission autorisée uniquement pour votre groupe' });
      next();
    } catch (error) { next(error); }
  },
  deliverableController.submitDeliverable.bind(deliverableController));

// Routes combinées dans les projets
router.get('/projects/:projectId/deliverables', authMiddleware, 
  deliverableController.getProjectDeliverables.bind(deliverableController));

export default router;
