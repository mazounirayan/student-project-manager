import { Router } from 'express';
import { ReportController } from '../controllers/report.controller';
import { authMiddleware, requireStudent, requireTeacher } from '../middleware/auth.middleware';
import {
  validateReportConfig, validateReportCreation, validateSectionConfig, validateSectionContent,
} from '../middleware/validation.middleware';

const router = Router();
const controller = new ReportController();

router.use(authMiddleware);

router.post('/', requireStudent, validateReportCreation, controller.create);
router.get('/projects/:projectId', requireTeacher, controller.listByProject);

router.get('/projects/:projectId/report-config', controller.getConfig);
router.post('/projects/:projectId/report-config', requireTeacher, validateReportConfig, controller.saveConfig);
router.put('/projects/:projectId/report-config', requireTeacher, validateReportConfig, controller.saveConfig);
router.put('/section-config/:id', requireTeacher, validateSectionConfig, controller.updateSectionConfig);
router.patch('/section-config/:id', requireTeacher, validateSectionConfig, controller.updateSectionConfig);

router.get('/groups/:groupId/projects/:projectId', controller.getGroupReport);
router.post('/groups/:groupId/projects/:projectId/submit', requireStudent, controller.submit);
router.put('/sections/:sectionConfigId/content', requireStudent, validateSectionContent, controller.saveSectionContent);

router.get('/:id/export', controller.exportPdf);

export default router;
