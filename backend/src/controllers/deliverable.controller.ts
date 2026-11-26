import { Request, Response } from 'express';
import { DeliverableService, UploadedSubmission } from '../services/deliverable.service';
import { currentUser } from '../middleware/auth.middleware';
import { removeUploadedFile } from '../middleware/upload.middleware';
import { parseId } from '../utils/route-id';

const uploadedSubmission = (req: Request): UploadedSubmission => ({
  groupId: req.body?.groupId,
  gitUrl: typeof req.body?.gitUrl === 'string' ? req.body.gitUrl.trim() : undefined,
  file: req.file,
});

export class DeliverableController {
  private deliverableService = new DeliverableService();

  create = async (req: Request, res: Response) => {
    res.status(201).json(await this.deliverableService.createDeliverable(currentUser(req).id, req.body));
  };

  update = async (req: Request, res: Response) => {
    res.json(await this.deliverableService.updateDeliverable(parseId(req.params.id), currentUser(req).id, req.body));
  };

  remove = async (req: Request, res: Response) => {
    await this.deliverableService.deleteDeliverable(parseId(req.params.id), currentUser(req).id);
    res.status(204).send();
  };

  addRule = async (req: Request, res: Response) => {
    res.status(201).json(await this.deliverableService.addRule(parseId(req.params.id), currentUser(req).id, req.body));
  };

  updateRule = async (req: Request, res: Response) => {
    const rule = await this.deliverableService.updateRule(parseId(req.params.id), parseId(req.params.ruleId), currentUser(req).id, req.body);
    res.json(rule);
  };

  removeRule = async (req: Request, res: Response) => {
    await this.deliverableService.deleteRule(parseId(req.params.id), parseId(req.params.ruleId), currentUser(req).id);
    res.status(204).send();
  };

  listByProject = async (req: Request, res: Response) => {
    res.json(await this.deliverableService.getProjectDeliverables(parseId(req.params.projectId), currentUser(req)));
  };

  listSubmissions = async (req: Request, res: Response) => {
    res.json(await this.deliverableService.getSubmissions(parseId(req.params.id), currentUser(req).id));
  };

  getGroupSubmission = async (req: Request, res: Response) => {
    res.json(await this.deliverableService.getGroupSubmission(parseId(req.params.id), parseId(req.params.groupId), currentUser(req).id));
  };

  /** Contrôle les règles sans rien enregistrer : le fichier envoyé est supprimé dans tous les cas. */
  validate = async (req: Request, res: Response) => {
    try {
      res.json(await this.deliverableService.validateBeforeSubmit(parseId(req.params.id), currentUser(req), uploadedSubmission(req)));
    } finally {
      removeUploadedFile(req.file);
    }
  };

  submit = async (req: Request, res: Response) => {
    try {
      res.status(201).json(await this.deliverableService.submit(parseId(req.params.id), currentUser(req), uploadedSubmission(req)));
    } catch (error) {
      removeUploadedFile(req.file);
      throw error;
    }
  };

  analyzeSimilarity = async (req: Request, res: Response) => {
    res.json(await this.deliverableService.analyzeSimilarity(parseId(req.params.id), currentUser(req).id));
  };

  getSimilarity = async (req: Request, res: Response) => {
    res.json(await this.deliverableService.getSimilarity(parseId(req.params.submissionId), currentUser(req).id));
  };

  download = async (req: Request, res: Response) => {
    const file = await this.deliverableService.getSubmissionFile(parseId(req.params.submissionId), currentUser(req));
    res.download(file.path, file.name);
  };
}
