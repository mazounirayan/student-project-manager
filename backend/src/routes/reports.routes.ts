import { Router } from 'express';
import { ReportController } from '../controllers/report.controller';
import { authMiddleware, requireProjectAccess } from '../middleware/auth.middleware';

const router = Router();
const reportController = new ReportController();

router.post('/', authMiddleware, reportController.createReport.bind(reportController));
router.put('/:id/sections', authMiddleware, reportController.updateSection.bind(reportController));

// Lecture des rapports : enseignant propriétaire du projet ou étudiant inscrit au projet.
router.get('/projects/:projectId', authMiddleware, requireProjectAccess, reportController.getProjectReports.bind(reportController));
router.get('/groups/:groupId/projects/:projectId', authMiddleware, requireProjectAccess, reportController.getGroupReport.bind(reportController));

export default router;
