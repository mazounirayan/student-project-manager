import { Request, Response } from 'express';
import { DefenseService } from '../services/defense.service';
import { currentUser } from '../middleware/auth.middleware';
import { parseId } from '../utils/route-id';

export class DefenseController {
  private defenseService = new DefenseService();

  schedule = async (req: Request, res: Response) => {
    const { startDateTime, endDateTime, durationPerGroup, breakMinutes, location, instructions } = req.body;
    const result = await this.defenseService.schedule(parseId(req.params.projectId), currentUser(req).id, {
      startDateTime, endDateTime, durationPerGroup, breakMinutes, location, instructions,
    });
    res.status(201).json(result);
  };

  reorder = async (req: Request, res: Response) => {
    res.json(await this.defenseService.reorder(parseId(req.params.projectId), currentUser(req).id, req.body.newOrder));
  };

  schedulePdf = async (req: Request, res: Response) => {
    const projectId = parseId(req.params.projectId);
    this.sendPdf(res, `planning-soutenances-${projectId}.pdf`, await this.defenseService.schedulePdf(projectId, currentUser(req).id));
  };

  attendancePdf = async (req: Request, res: Response) => {
    const projectId = parseId(req.params.projectId);
    const orderType = req.query.orderType === 'alphabetical' ? 'alphabetical' : 'group';
    this.sendPdf(res, `emargement-${projectId}.pdf`, await this.defenseService.attendancePdf(projectId, currentUser(req).id, orderType));
  };

  private sendPdf(res: Response, filename: string, pdf: Buffer) {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdf);
  }
}
