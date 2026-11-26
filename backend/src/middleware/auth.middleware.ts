import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../database/data-source';
import { Role, User } from '../entities/Entities';
import { jwtSecret } from '../config/secrets';
import { unauthorized } from '../utils/http-error';

export interface AuthUser {
  id: number;
  email: string;
  role: Role;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = /^Bearer (.+)$/.exec(req.header('Authorization') ?? '')?.[1];
  if (!token) return res.status(401).json({ error: 'Authentification requise' });

  let userId: unknown;
  try {
    userId = (jwt.verify(token, jwtSecret('JWT_SECRET'), { algorithms: ['HS256'] }) as jwt.JwtPayload).id;
  } catch {
    return res.status(401).json({ error: 'Session expirée ou jeton invalide' });
  }

  const user = typeof userId === 'number'
    ? await AppDataSource.getRepository(User).findOne({ where: { id: userId, isActive: true } })
    : null;
  if (!user) return res.status(401).json({ error: 'Compte introuvable ou désactivé' });

  req.user = { id: user.id, email: user.email, role: user.role };
  next();
}

const requireRole = (role: Role) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user) return res.status(401).json({ error: 'Authentification requise' });
  if (req.user.role !== role) {
    return res.status(403).json({ error: role === 'teacher' ? 'Accès réservé aux enseignants' : 'Accès réservé aux étudiants' });
  }
  next();
};

export const requireTeacher = requireRole('teacher');
export const requireStudent = requireRole('student');

/** Utilisateur authentifié de la requête (les routes concernées passent par authMiddleware). */
export function currentUser(req: Request): AuthUser {
  const user = (req as AuthenticatedRequest).user;
  if (!user) throw unauthorized();
  return user;
}
