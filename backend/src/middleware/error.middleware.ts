import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { HttpError } from '../utils/http-error';

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({ error: 'Route introuvable' });
};

interface DriverError extends Error {
  code?: string;
  type?: string;
  status?: number;
  driverError?: { code?: string };
}

export const errorHandler = (err: DriverError, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Fichier trop volumineux (50 Mo maximum)' });
    return res.status(400).json({ error: 'Envoi de fichier invalide' });
  }

  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Corps de requête JSON invalide' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Requête trop volumineuse' });

  if (err.name === 'QueryFailedError') {
    const duplicate = err.driverError?.code === 'ER_DUP_ENTRY';
    return res.status(duplicate ? 409 : 400).json({ error: duplicate ? 'Cette ressource existe déjà' : 'Données invalides' });
  }

  console.error('Erreur non gérée :', err);
  res.status(500).json({ error: 'Erreur interne du serveur' });
};
