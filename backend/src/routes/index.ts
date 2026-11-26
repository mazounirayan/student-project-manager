import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './users.routes';
import promotionRoutes from './promotions.routes';
import projectRoutes from './projects.routes';
import groupRoutes from './groups.routes';
import deliverableRoutes from './deliverables.routes';
import submissionRoutes from './submissions.routes';
import reportRoutes from './reports.routes';
import defenseRoutes from './defenses.routes';
import gradingRoutes from './grading.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/promotions', promotionRoutes);
router.use('/projects', projectRoutes);
router.use('/groups', groupRoutes);
router.use('/deliverables', deliverableRoutes);
router.use('/submissions', submissionRoutes);
router.use('/reports', reportRoutes);
router.use('/defenses', defenseRoutes);
router.use('/grading', gradingRoutes);

export default router;
