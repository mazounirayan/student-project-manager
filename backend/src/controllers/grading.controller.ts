import { Request, Response } from 'express';
import { GradingService, SessionFilters } from '../services/grading.service';
import { currentUser } from '../middleware/auth.middleware';
import { badRequest } from '../utils/http-error';
import { parseId, parseOptionalId } from '../utils/route-id';

const GRID_TYPES = ['deliverable', 'report', 'defense'] as const;

function parseGridType(value: unknown) {
  if (value === undefined || value === '') return undefined;
  if (!GRID_TYPES.includes(value as typeof GRID_TYPES[number])) throw badRequest('Type de grille invalide');
  return value as typeof GRID_TYPES[number];
}

export class GradingController {
  private gradingService = new GradingService();

  createGrid = async (req: Request, res: Response) => {
    res.status(201).json(await this.gradingService.createGrid(currentUser(req).id, req.body));
  };

  updateGrid = async (req: Request, res: Response) => {
    res.json(await this.gradingService.updateGrid(parseId(req.params.id), currentUser(req).id, req.body));
  };

  deleteGrid = async (req: Request, res: Response) => {
    await this.gradingService.deleteGrid(parseId(req.params.id), currentUser(req).id);
    res.json({ success: true });
  };

  listProjectGrids = async (req: Request, res: Response) => {
    res.json(await this.gradingService.listProjectGrids(parseId(req.params.projectId), currentUser(req).id, parseGridType(req.query.type)));
  };

  addCriterion = async (req: Request, res: Response) => {
    res.status(201).json(await this.gradingService.addCriterion(parseId(req.params.id), currentUser(req).id, req.body));
  };

  updateCriterion = async (req: Request, res: Response) => {
    res.json(await this.gradingService.updateCriterion(parseId(req.params.id), currentUser(req).id, req.body));
  };

  deleteCriterion = async (req: Request, res: Response) => {
    await this.gradingService.deleteCriterion(parseId(req.params.id), currentUser(req).id);
    res.json({ success: true });
  };

  createSession = async (req: Request, res: Response) => {
    res.status(201).json(await this.gradingService.createSession(currentUser(req).id, req.body));
  };

  updateSession = async (req: Request, res: Response) => {
    res.json(await this.gradingService.updateSession(parseId(req.params.id), currentUser(req).id, req.body));
  };

  listSessions = async (req: Request, res: Response) => {
    const filters: SessionFilters = {
      gridId: parseOptionalId(req.query.gridId),
      groupId: parseOptionalId(req.query.groupId),
      projectId: parseOptionalId(req.query.projectId),
      type: parseGridType(req.query.type),
    };
    res.json(await this.gradingService.listSessions(currentUser(req), filters));
  };

  myGrades = async (req: Request, res: Response) => {
    res.json(await this.gradingService.getStudentGrades(currentUser(req).id));
  };

  summary = async (req: Request, res: Response) => {
    res.json(await this.gradingService.getProjectSummary(parseId(req.params.projectId), currentUser(req).id));
  };

  updateWeights = async (req: Request, res: Response) => {
    await this.gradingService.updateWeights(parseId(req.params.projectId), currentUser(req).id, req.body.weights);
    res.json({ success: true });
  };

  exportCsv = async (req: Request, res: Response) => {
    const projectId = parseId(req.params.projectId);
    const csv = await this.gradingService.exportProjectGrades(projectId, currentUser(req).id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="notes-projet-${projectId}.csv"`);
    res.send(csv);
  };

  validateGrades = async (req: Request, res: Response) => {
    await this.gradingService.validateProjectGrades(parseId(req.body.projectId), currentUser(req).id);
    res.json({ success: true });
  };
}
