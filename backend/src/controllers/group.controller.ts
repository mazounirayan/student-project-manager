import { Request, Response } from 'express';
import { GroupService } from '../services/group.service';
import { currentUser } from '../middleware/auth.middleware';
import { parseId } from '../utils/route-id';

export class GroupController {
  private groupService = new GroupService();

  listByProject = async (req: Request, res: Response) => {
    res.json(await this.groupService.getProjectGroups(parseId(req.params.projectId), currentUser(req)));
  };

  join = async (req: Request, res: Response) => {
    res.json(await this.groupService.joinGroup(parseId(req.params.id), currentUser(req).id));
  };

  saveGrouping = async (req: Request, res: Response) => {
    const groups = req.body.groups.map((group: { id: number; memberIds: number[] }) => ({
      id: Number(group.id),
      memberIds: group.memberIds.map(Number),
    }));
    res.json(await this.groupService.saveGrouping(parseId(req.params.id), currentUser(req).id, groups));
  };
}
