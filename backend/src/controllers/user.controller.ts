import { Request, Response } from 'express';
import { UserService } from '../services/user.service';
import { currentUser } from '../middleware/auth.middleware';
import { parseId } from '../utils/route-id';

export class UserController {
  private userService = new UserService();

  getProfile = async (req: Request, res: Response) => {
    res.json(await this.userService.getById(currentUser(req).id));
  };

  updateProfile = async (req: Request, res: Response) => {
    const { firstName, lastName } = req.body;
    res.json(await this.userService.updateProfile(currentUser(req).id, { firstName, lastName }));
  };

  search = async (req: Request, res: Response) => {
    const role = req.query.role === 'teacher' || req.query.role === 'student' ? req.query.role : undefined;
    res.json(await this.userService.search(String(req.query.q ?? ''), role));
  };

  listStudents = async (_req: Request, res: Response) => {
    res.json(await this.userService.listActiveByRole('student'));
  };

  listTeachers = async (_req: Request, res: Response) => {
    res.json(await this.userService.listActiveByRole('teacher'));
  };

  deactivate = async (req: Request, res: Response) => {
    res.json(await this.userService.deactivateStudent(parseId(req.params.id)));
  };
}
