import { Request, Response } from 'express';
import { ProjectService } from '../services/project.service';
import { currentUser } from '../middleware/auth.middleware';
import { parseId } from '../utils/route-id';

export class ProjectController {
  private projectService = new ProjectService();

  create = async (req: Request, res: Response) => {
    const project = await this.projectService.createProject(currentUser(req).id, req.body);
    res.status(201).json(project);
  };

  listMine = async (req: Request, res: Response) => {
    res.json(await this.projectService.getMyProjects(currentUser(req)));
  };

  getById = async (req: Request, res: Response) => {
    res.json(await this.projectService.getProjectDetail(parseId(req.params.id), currentUser(req)));
  };

  update = async (req: Request, res: Response) => {
    res.json(await this.projectService.updateProject(parseId(req.params.id), currentUser(req).id, req.body));
  };

  remove = async (req: Request, res: Response) => {
    await this.projectService.deleteProject(parseId(req.params.id), currentUser(req).id);
    res.status(204).send();
  };
}
