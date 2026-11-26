import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { AppDataSource } from '../database/data-source';
import { User } from '../entities/Entities';
import { jwtSecret } from '../config/secrets';
import { PasswordService } from '../utils/password.service';
import { EmailService } from '../utils/email.service';
import { conflict, unauthorized, badRequest } from '../utils/http-error';

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface AuthResult {
  user: ReturnType<User['toJSON']>;
  token: string;
  refreshToken: string;
}

interface OAuthProfile {
  providerId: string;
  email: string;
  firstName: string;
  lastName: string;
}

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

// Hash factice : une connexion sur un compte inconnu coûte le même temps qu'un mot de passe erroné.
const DUMMY_HASH = bcrypt.hashSync(PasswordService.generateResetToken(), 10);

const users = () => AppDataSource.getRepository(User);
const publicUser = (user: User) => User.prototype.toJSON.call(user);

export class AuthService {
  private emailService = new EmailService();

  async login(email: string, password: string): Promise<AuthResult> {
    const user = await users()
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.email = :email', { email: email.trim().toLowerCase() })
      .getOne();

    const valid = await PasswordService.comparePasswords(password, user?.password ?? DUMMY_HASH);
    if (!user || !user.isActive || !valid) throw unauthorized('Identifiants invalides');
    return this.issueTokens(user);
  }

  async registerStudent(data: RegisterData): Promise<AuthResult> {
    const email = data.email.trim().toLowerCase();
    if (await users().findOne({ where: { email } })) throw conflict('Un compte existe déjà avec cette adresse email');

    const user = await users().save(users().create({
      email,
      password: await PasswordService.hashPassword(data.password),
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      role: 'student',
    }));
    return this.issueTokens(user);
  }

  async authenticateWithGoogle(idToken: string): Promise<AuthResult> {
    return this.authenticateWithProvider('googleId', await this.verifyGoogleToken(idToken));
  }

  async authenticateWithMicrosoft(accessToken: string): Promise<AuthResult> {
    return this.authenticateWithProvider('microsoftId', await this.verifyMicrosoftToken(accessToken));
  }

  async requestPasswordReset(email: string): Promise<void> {
    const user = await users().findOne({ where: { email: email.trim().toLowerCase(), isActive: true } });
    if (!user) return;

    const token = PasswordService.generateResetToken();
    await users().update(user.id, {
      resetToken: PasswordService.hashToken(token),
      resetTokenExpiry: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    });
    this.emailService.sendPasswordResetEmail(user.email, user.firstName, token)
      .catch(error => console.error("Échec d'envoi de l'email de réinitialisation :", error.message));
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const user = await users().findOne({
      where: { resetToken: PasswordService.hashToken(token) },
      select: { id: true, resetTokenExpiry: true },
    });
    if (!user?.resetTokenExpiry || user.resetTokenExpiry < new Date()) throw badRequest('Lien de réinitialisation invalide ou expiré');

    await users().update(user.id, {
      password: await PasswordService.hashPassword(newPassword),
      resetToken: null,
      resetTokenExpiry: null,
    });
  }

  async refreshAccessToken(refreshToken: string): Promise<{ token: string; refreshToken: string }> {
    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(refreshToken, jwtSecret('JWT_REFRESH_SECRET'), { algorithms: ['HS256'] }) as jwt.JwtPayload;
    } catch {
      throw unauthorized('Session expirée, reconnectez-vous');
    }
    const user = payload.type === 'refresh' && typeof payload.id === 'number'
      ? await users().findOne({ where: { id: payload.id, isActive: true } })
      : null;
    if (!user) throw unauthorized('Session expirée, reconnectez-vous');

    const { token, refreshToken: nextRefreshToken } = this.issueTokens(user);
    return { token, refreshToken: nextRefreshToken };
  }

  private async authenticateWithProvider(idField: 'googleId' | 'microsoftId', profile: OAuthProfile): Promise<AuthResult> {
    const email = profile.email.toLowerCase();
    let user = await users().findOne({ where: { email } });

    if (!user) {
      user = await users().save(users().create({
        email,
        firstName: profile.firstName,
        lastName: profile.lastName,
        role: 'student',
        [idField]: profile.providerId,
        password: await PasswordService.hashPassword(PasswordService.generateResetToken()),
      }));
    } else {
      if (!user.isActive) throw unauthorized('Compte désactivé');
      if (!user[idField]) {
        user[idField] = profile.providerId;
        await users().save(user);
      }
    }
    return this.issueTokens(user);
  }

  private issueTokens(user: User): AuthResult {
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      jwtSecret('JWT_SECRET'),
      { expiresIn: process.env.JWT_EXPIRES_IN || '1h' } as jwt.SignOptions,
    );
    const refreshToken = jwt.sign(
      { id: user.id, type: 'refresh' },
      jwtSecret('JWT_REFRESH_SECRET'),
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' } as jwt.SignOptions,
    );
    return { user: publicUser(user), token, refreshToken };
  }

  private async verifyGoogleToken(idToken: string): Promise<OAuthProfile> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) throw unauthorized('Connexion Google non configurée');
    const ticket = await new OAuth2Client(clientId).verifyIdToken({ idToken, audience: clientId }).catch(() => null);
    const payload = ticket?.getPayload();
    if (!payload?.email || !payload.email_verified) throw unauthorized('Jeton Google invalide');
    return {
      providerId: payload.sub,
      email: payload.email,
      firstName: payload.given_name ?? '',
      lastName: payload.family_name ?? '',
    };
  }

  private async verifyMicrosoftToken(accessToken: string): Promise<OAuthProfile> {
    const response = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    }).catch(() => null);
    if (!response?.ok) throw unauthorized('Jeton Microsoft invalide');
    const profile = await response.json() as { id: string; mail?: string; userPrincipalName?: string; givenName?: string; surname?: string };
    const email = profile.mail || profile.userPrincipalName;
    if (!email) throw unauthorized('Jeton Microsoft invalide');
    return { providerId: profile.id, email, firstName: profile.givenName ?? '', lastName: profile.surname ?? '' };
  }
}
