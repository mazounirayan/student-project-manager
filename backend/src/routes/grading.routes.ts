import { Router } from 'express';
import { GradingController } from '../controllers/grading.controller';
import { authMiddleware, requireStudent, requireTeacher } from '../middleware/auth.middleware';
import {
  validateCriterion, validateGrid, validatePublication, validateSession, validateWeights,
} from '../middleware/validation.middleware';

const router = Router();
const controller = new GradingController();

router.use(authMiddleware);

// Lecture partagée : le service restreint les étudiants à leurs notes publiées.
router.get('/sessions', controller.listSessions);
router.get('/students/my-grades', requireStudent, controller.myGrades);
router.get('/students/my-summary', requireStudent, controller.myOverview);

router.use(requireTeacher);

router.post('/grids', validateGrid(false), controller.createGrid);
router.put('/grids/:id', validateGrid(true), controller.updateGrid);
router.patch('/grids/:id', validateGrid(true), controller.updateGrid);
router.delete('/grids/:id', controller.deleteGrid);
router.post('/grids/:id/criteria', validateCriterion(false), controller.addCriterion);

router.put('/criteria/:id', validateCriterion(true), controller.updateCriterion);
router.patch('/criteria/:id', validateCriterion(true), controller.updateCriterion);
router.delete('/criteria/:id', controller.deleteCriterion);

router.post('/sessions', validateSession, controller.createSession);
router.put('/sessions/:id', validateSession, controller.updateSession);
router.patch('/sessions/:id', validateSession, controller.updateSession);
router.post('/grades/publish', validatePublication, controller.publishGrades);

router.get('/projects/:projectId/grids', controller.listProjectGrids);
router.get('/projects/:projectId/summary', controller.summary);
router.get('/projects/:projectId/export', controller.exportCsv);
router.put('/projects/:projectId/weights', validateWeights, controller.updateWeights);

export default router;
