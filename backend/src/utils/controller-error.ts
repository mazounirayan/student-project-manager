import { Response } from 'express';

/**
 * Gestion d'erreur commune des contrôleurs.
 * - Respecte `error.status` (posé par ex. par `parseRouteId`) au lieu de tout
 *   transformer en 500.
 * - Masque les messages internes en cas d'erreur inattendue.
 */
export function controllerError(res: Response, error: unknown): void {
  const status = (error as { status?: unknown })?.status;
  if (typeof status === 'number' && Number.isInteger(status) && status >= 400 && status < 600) {
    const message = (error as { message?: unknown })?.message;
    res.status(status).json({ error: typeof message === 'string' && message ? message : 'Requête invalide' });
    return;
  }
  if (process.env.NODE_ENV !== 'test') {
    console.error('[API] Erreur non gérée :', error);
  }
  res.status(500).json({ error: 'Internal Server Error' });
}
