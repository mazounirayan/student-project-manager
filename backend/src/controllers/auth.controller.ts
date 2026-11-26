import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { UserService } from '../services/user.service';
import { currentUser } from '../middleware/auth.middleware';

export class AuthController {
  private authService = new AuthService();
  private userService = new UserService();

  login = async (req: Request, res: Response) => {
    res.json(await this.authService.login(req.body.email, req.body.password));
  };

  registerStudent = async (req: Request, res: Response) => {
    const { email, password, firstName, lastName } = req.body;
    res.status(201).json(await this.authService.registerStudent({ email, password, firstName, lastName }));
  };

  googleOAuth = async (req: Request, res: Response) => {
    res.json(await this.authService.authenticateWithGoogle(req.body.token));
  };

  microsoftOAuth = async (req: Request, res: Response) => {
    res.json(await this.authService.authenticateWithMicrosoft(req.body.token));
  };

  refreshToken = async (req: Request, res: Response) => {
    res.json(await this.authService.refreshAccessToken(req.body.refreshToken));
  };

  forgotPassword = async (req: Request, res: Response) => {
    await this.authService.requestPasswordReset(req.body.email);
    // Réponse identique que le compte existe ou non, pour ne pas révéler les adresses inscrites.
    res.json({ message: 'Si un compte existe pour cette adresse, un lien de réinitialisation vient d\'être envoyé.' });
  };

  resetPassword = async (req: Request, res: Response) => {
    await this.authService.resetPassword(req.body.token, req.body.newPassword);
    res.json({ message: 'Mot de passe réinitialisé' });
  };

  verifyToken = async (req: Request, res: Response) => {
    res.json({ valid: true, user: await this.userService.getById(currentUser(req).id) });
  };

  getCurrentUser = async (req: Request, res: Response) => {
    res.json(await this.userService.getById(currentUser(req).id));
  };

  /** Les jetons sont sans état : la déconnexion consiste à les supprimer côté client. */
  logout = (_req: Request, res: Response) => {
    res.json({ message: 'Déconnexion effectuée' });
  };
}
