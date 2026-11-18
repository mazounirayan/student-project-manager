import { parseRouteId } from '../utils/route-id';
import { controllerError } from '../utils/controller-error';
import { Request, Response } from 'express';
import { GroupService } from '../services/group.service';

export class GroupController {
  private groupService: GroupService;

  constructor() {
    this.groupService = new GroupService();
  }

  /**
   * @swagger
   * /api/groups:
   *   post:
   *     summary: Create a new group
   *     tags: [Groups]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [projectId, name, memberIds]
   *             properties:
   *               projectId:
   *                 type: integer
   *               name:
   *                 type: string
   *               memberIds:
   *                 type: array
   *                 items:
   *                   type: integer
   *     responses:
   *       201:
   *         description: Group created successfully
   */
  async createGroup(req: Request, res: Response) {
    try {
      const { projectId, name, memberIds } = req.body;
      const group = await this.groupService.createGroup(projectId, name, memberIds);
      res.status(201).json(group);
    } catch (error) {
      controllerError(res, error);
    }
  }

  /**
   * @swagger
   * /api/groups/{id}/join:
   *   post:
   *     summary: Join a group (for students)
   *     tags: [Groups]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Joined group successfully
   */
  async joinGroup(req: Request, res: Response) {
    try {
      const groupId = parseRouteId(req.params.id);
      const studentId = (req as any).user?.id;
      const group = await this.groupService.joinGroup(groupId, studentId);
      res.json(group);
    } catch (error) {
      controllerError(res, error);
    }
  }

  /**
   * @swagger
   * /api/groups/project/{projectId}/groups:
   *   get:
   *     summary: Get all groups for a project
   *     tags: [Groups]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: projectId
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Groups retrieved successfully
   */
  async getProjectGroups(req: Request, res: Response) {
    try {
      const projectId = parseRouteId(req.params.projectId);
      const groups = await this.groupService.getGroupsByProject(projectId);
      res.json(groups);
    } catch (error) {
      controllerError(res, error);
    }
  }

  /**
   * @swagger
   * /api/projects/{projectId}/groups:
   *   put:
   *     summary: Save the full group distribution for a project
   *     tags: [Groups]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: projectId
   *         required: true
   *         schema:
   *           type: integer
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [groups, unassignedIds]
   *             properties:
   *               groups:
   *                 type: array
   *                 items:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: integer
   *                     memberIds:
   *                       type: array
   *                       items:
   *                         type: integer
   *               unassignedIds:
   *                 type: array
   *                 items:
   *                   type: integer
   *     responses:
   *       200:
   *         description: Group distribution saved successfully
   */
  async saveProjectGrouping(req: Request, res: Response) {
    try {
      const projectId = parseRouteId(req.params.projectId);
      const { groups, unassignedIds } = req.body;
      if (!Array.isArray(groups)) {
        return res.status(400).json({ error: 'Le champ "groups" doit être un tableau.' });
      }
      const result = await this.groupService.saveProjectGrouping(
        projectId,
        groups,
        Array.isArray(unassignedIds) ? unassignedIds : []
      );
      res.json(result);
    } catch (error) {
      controllerError(res, error);
    }
  }
}
