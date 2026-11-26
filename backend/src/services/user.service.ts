import { AppDataSource } from '../database/data-source';
import { Role, User } from '../entities/Entities';
import { badRequest, forbidden, notFound } from '../utils/http-error';

const users = () => AppDataSource.getRepository(User);

export class UserService {
  async getById(id: number): Promise<User> {
    const user = await users().findOne({ where: { id } });
    if (!user) throw notFound('Utilisateur introuvable');
    return user;
  }

  async updateProfile(id: number, profile: { firstName?: string; lastName?: string }): Promise<User> {
    const user = await this.getById(id);
    if (profile.firstName !== undefined) user.firstName = profile.firstName.trim();
    if (profile.lastName !== undefined) user.lastName = profile.lastName.trim();
    return users().save(user);
  }

  /** Un enseignant peut désactiver un compte étudiant, jamais un autre enseignant. */
  async deactivateStudent(id: number): Promise<User> {
    const user = await this.getById(id);
    if (user.role !== 'student') throw forbidden('Seuls les comptes étudiants peuvent être désactivés');
    user.isActive = false;
    return users().save(user);
  }

  listActiveByRole(role: Role): Promise<User[]> {
    return users().find({ where: { role, isActive: true }, order: { lastName: 'ASC', firstName: 'ASC' } });
  }

  async search(query: string, role?: Role): Promise<User[]> {
    const term = query.trim();
    if (term.length < 2) throw badRequest('La recherche doit contenir au moins 2 caractères');
    const like = `%${term.replace(/[\\%_]/g, '\\$&')}%`;

    const builder = users().createQueryBuilder('user')
      .where('user.isActive = true')
      .andWhere('(user.firstName LIKE :like OR user.lastName LIKE :like OR user.email LIKE :like)', { like });
    if (role) builder.andWhere('user.role = :role', { role });
    return builder.orderBy('user.lastName').take(50).getMany();
  }
}
