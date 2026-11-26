import { Request, Response } from 'express';
import { ReportService } from '../services/report.service';
import { currentUser } from '../middleware/auth.middleware';
import { parseId } from '../utils/route-id';

export class ReportController {
  private reportService = new ReportService();

  create = async (req: Request, res: Response) => {
    const { projectId, groupId, title } = req.body;
    res.status(201).json(await this.reportService.createReport(parseId(projectId), parseId(groupId), currentUser(req), title));
  };

  listByProject = async (req: Request, res: Response) => {
    res.json(await this.reportService.listProjectReports(parseId(req.params.projectId), currentUser(req).id));
  };

  getConfig = async (req: Request, res: Response) => {
    res.json(await this.reportService.getConfig(parseId(req.params.projectId), currentUser(req)));
  };

  saveConfig = async (req: Request, res: Response) => {
    res.json(await this.reportService.saveConfig(parseId(req.params.projectId), currentUser(req).id, req.body));
  };

  updateSectionConfig = async (req: Request, res: Response) => {
    res.json(await this.reportService.updateSectionConfig(parseId(req.params.id), currentUser(req).id, req.body));
  };

  getGroupReport = async (req: Request, res: Response) => {
    res.json(await this.reportService.getGroupReport(parseId(req.params.groupId), parseId(req.params.projectId), currentUser(req)));
  };

  submit = async (req: Request, res: Response) => {
    res.json(await this.reportService.submitReport(parseId(req.params.groupId), parseId(req.params.projectId), currentUser(req).id));
  };

  saveSectionContent = async (req: Request, res: Response) => {
    const section = await this.reportService.saveSectionContent(
      parseId(req.params.sectionConfigId), parseId(req.body.groupId), currentUser(req).id, req.body.content);
    res.json(section);
  };

  exportPdf = async (req: Request, res: Response) => {
    const { pdf, filename } = await this.reportService.exportPdf(parseId(req.params.id), currentUser(req));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdf);
  };
}
