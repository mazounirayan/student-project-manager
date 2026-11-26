import { AppDataSource } from '../database/data-source';
import { Group, Project, Promotion, Role } from '../entities/Entities';
import { forbidden, notFound } from '../utils/http-error';

export interface Actor {
  id: number;
  role: Role;
}

/** Projet appartenant à l'enseignant. */
export async function findOwnedProject(projectId: number, teacherId: number, relations: string[] = []): Promise<Project> {
  const project = await AppDataSource.getRepository(Project).findOne({
    where: { id: projectId },
    relations: ['teacher', ...relations],
  });
  if (!project) throw notFound('Projet introuvable');
  if (project.teacher?.id !== teacherId) throw forbidden('Ce projet appartient à un autre enseignant');
  return project;
}

/**
 * Projet accessible à l'utilisateur : son propriétaire pour un enseignant, un projet
 * visible de sa promotion pour un étudiant.
 */
export async function findProjectForActor(projectId: number, actor: Actor, relations: string[] = []): Promise<Project> {
  if (actor.role === 'teacher') return findOwnedProject(projectId, actor.id, relations);
  const project = await AppDataSource.getRepository(Project).findOne({
    where: { id: projectId, status: 'visible', promotion: { students: { id: actor.id } } },
    relations,
  });
  if (!project) throw notFound('Projet introuvable');
  return project;
}

/** Groupe accessible à l'utilisateur : membre pour un étudiant, enseignant du projet sinon. */
export async function findGroupForActor(groupId: number, actor: Actor): Promise<Group> {
  const group = await AppDataSource.getRepository(Group).findOne({
    where: { id: groupId },
    relations: ['project', 'project.teacher', 'members'],
  });
  if (!group) throw notFound('Groupe introuvable');
  const allowed = actor.role === 'teacher'
    ? group.project.teacher?.id === actor.id
    : group.members.some(member => member.id === actor.id);
  if (!allowed) throw forbidden("Vous n'avez pas accès à ce groupe");
  return group;
}

/** Groupe de l'étudiant dans un projet, ou null. */
export async function findStudentGroup(projectId: number, studentId: number): Promise<Group | null> {
  return AppDataSource.getRepository(Group).findOne({
    where: { project: { id: projectId }, members: { id: studentId } },
  });
}

export async function findOwnedPromotion(promotionId: number, teacherId: number, relations: string[] = []): Promise<Promotion> {
  const promotion = await AppDataSource.getRepository(Promotion).findOne({
    where: { id: promotionId },
    relations: ['teacher', ...relations],
  });
  if (!promotion) throw notFound('Promotion introuvable');
  if (promotion.teacher?.id !== teacherId) throw forbidden('Cette promotion appartient à un autre enseignant');
  return promotion;
}
