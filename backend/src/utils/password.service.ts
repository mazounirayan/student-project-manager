import bcrypt from 'bcrypt';
import crypto from 'crypto';

const SALT_ROUNDS = 10;

export class PasswordService {
  static hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  static comparePasswords(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  static generateTemporaryPassword(length = 12): string {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    return Array.from({ length }, () => charset.charAt(crypto.randomInt(charset.length))).join('');
  }

  static generateResetToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /** Les jetons de réinitialisation sont stockés sous forme d'empreinte. */
  static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
