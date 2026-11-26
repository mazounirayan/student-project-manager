import { Request, Response } from 'express';
import { PromotionService, StudentInput } from '../services/promotion.service';
import { currentUser } from '../middleware/auth.middleware';
import { removeUploadedFile } from '../middleware/upload.middleware';
import { badRequest } from '../utils/http-error';
import { parseId } from '../utils/route-id';

export class PromotionController {
  private promotionService = new PromotionService();

  create = async (req: Request, res: Response) => {
    const { name, description, year } = req.body;
    res.status(201).json(await this.promotionService.createPromotion(currentUser(req).id, { name, description, year }));
  };

  listMine = async (req: Request, res: Response) => {
    res.json(await this.promotionService.getPromotionsByTeacher(currentUser(req).id));
  };

  update = async (req: Request, res: Response) => {
    const { name, description, year } = req.body;
    res.json(await this.promotionService.updatePromotion(parseId(req.params.id), currentUser(req).id, { name, description, year }));
  };

  remove = async (req: Request, res: Response) => {
    await this.promotionService.deletePromotion(parseId(req.params.id), currentUser(req).id);
    res.status(204).send();
  };

  /** Corps attendu : un tableau d'étudiants `{ email, firstName?, lastName? }`. */
  addStudents = async (req: Request, res: Response) => {
    if (!Array.isArray(req.body)) throw badRequest('Un tableau d\'étudiants est attendu');
    const students: StudentInput[] = req.body.map(({ email, firstName, lastName }) => ({
      email: typeof email === 'string' ? email : undefined,
      firstName: typeof firstName === 'string' ? firstName : undefined,
      lastName: typeof lastName === 'string' ? lastName : undefined,
    }));
    const { promotion } = await this.promotionService.addStudents(parseId(req.params.id), currentUser(req).id, students);
    res.status(201).json(promotion);
  };

  removeStudent = async (req: Request, res: Response) => {
    await this.promotionService.removeStudent(parseId(req.params.id), currentUser(req).id, parseId(req.params.studentId));
    res.status(204).send();
  };

  importStudents = async (req: Request, res: Response) => {
    try {
      if (!req.file) throw badRequest('Aucun fichier reçu');
      res.json(await this.promotionService.importStudents(parseId(req.params.id), currentUser(req).id, req.file));
    } finally {
      removeUploadedFile(req.file);
    }
  };
}
