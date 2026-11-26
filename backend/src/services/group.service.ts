import { AppDataSource } from '../database/data-source';
import { Group, Project, User } from '../entities/Entities';
import { badRequest, conflict, forbidden, notFound } from '../utils/http-error';
import { serializeGroup } from '../serializers';
import { Actor, findOwnedProject, findProjectForActor, findStudentGroup } from './access.service';

export interface GroupAssignment {
  id: number;
  memberIds: number[];
}

const groups = () => AppDataSource.getRepository(Group);

export class GroupService {
  async getProjectGroups(projectId: number, actor: Actor) {
    await findProjectForActor(projectId, actor);
    const list = await groups().find({ where: { project: { id: projectId } }, relations: ['members'], order: { id: 'ASC' } });
    return list.map(serializeGroup);
  }

  /**
   * Crée un groupe. L'enseignant du projet crée un groupe vide (la répartition se fait ensuite) ;
   * un étudiant n'en crée un que si le projet est en formation libre, et il en devient le premier membre.
   */
  async createGroup(projectId: number, actor: Actor) {
    if (actor.role === 'teacher') {
      const project = await findOwnedProject(projectId, actor.id, ['groups']);
      return serializeGroup(await this.saveNewGroup(project, []));
    }

    const project = await findProjectForActor(projectId, actor, ['groups']);
    this.assertFreeFormationOpen(project);
    if (await findStudentGroup(project.id, actor.id)) throw conflict('Vous appartenez déjà à un groupe de ce projet');
    const student = await AppDataSource.getRepository(User).findOneOrFail({ where: { id: actor.id } });
    return serializeGroup(await this.saveNewGroup(project, [student]));
  }

  /** Supprime un groupe vide, sans rendu ni rapport (sinon la suppression emporterait le travail déposé). */
  async deleteGroup(groupId: number, teacherId: number) {
    const group = await groups().findOne({ where: { id: groupId }, relations: ['project', 'project.teacher', 'members', 'deliverableSubmissions', 'reports'] });
    if (!group) throw notFound('Groupe introuvable');
    if (group.project.teacher?.id !== teacherId) throw forbidden('Ce projet appartient à un autre enseignant');
    if (group.members.length > 0) throw conflict("Ce groupe a encore des membres : déplacez-les avant de le supprimer");
    if (group.deliverableSubmissions?.length || group.reports?.length) {
      throw conflict('Ce groupe a déjà déposé un rendu ou un rapport : il ne peut pas être supprimé');
    }
    await groups().remove(group);
  }

  async joinGroup(groupId: number, studentId: number) {
    const group = await groups().findOne({ where: { id: groupId }, relations: ['project', 'project.promotion', 'members'] });
    if (!group) throw notFound('Groupe introuvable');

    const project = await findProjectForActor(group.project.id, { id: studentId, role: 'student' });
    this.assertFreeFormationOpen(project);
    if (project.maxGroupSize && group.members.length >= project.maxGroupSize) throw forbidden('Ce groupe est complet');
    if (await findStudentGroup(project.id, studentId)) throw conflict('Vous appartenez déjà à un groupe de ce projet');

    const student = await AppDataSource.getRepository(User).findOneByOrFail({ id: studentId });
    group.members.push(student);
    return serializeGroup(await groups().save(group));
  }

  /** Un étudiant quitte son groupe, tant que les groupes sont en formation libre et avant la date limite. */
  async leaveGroup(groupId: number, studentId: number) {
    const group = await groups().findOne({ where: { id: groupId }, relations: ['project', 'members'] });
    if (!group || !group.members.some(member => member.id === studentId)) throw notFound('Groupe introuvable');

    const project = await findProjectForActor(group.project.id, { id: studentId, role: 'student' });
    this.assertFreeFormationOpen(project, 'quitter');
    group.members = group.members.filter(member => member.id !== studentId);
    return serializeGroup(await groups().save(group));
  }

  /**
   * Enregistre la répartition complète d'un projet : les groupes inconnus sont créés,
   * les groupes absents de la requête sont vidés (leurs soumissions et rapports sont conservés).
   */
  async saveGrouping(projectId: number, teacherId: number, assignments: GroupAssignment[]) {
    const project = await findOwnedProject(projectId, teacherId, ['promotion', 'promotion.students', 'groups', 'groups.members']);
    const enrolled = new Map((project.promotion?.students ?? []).map(student => [student.id, student]));

    const seen = new Set<number>();
    for (const memberId of assignments.flatMap(assignment => assignment.memberIds)) {
      if (!enrolled.has(memberId)) throw badRequest("Un des étudiants n'appartient pas à la promotion du projet");
      if (seen.has(memberId)) throw badRequest('Un étudiant ne peut appartenir qu\'à un seul groupe');
      seen.add(memberId);
    }

    const existing = new Map(project.groups.map(group => [group.id, group]));
    const payloadIds = new Set(assignments.map(assignment => assignment.id));
    const toSave: Group[] = [];
    let nextNumber = project.groups.length + 1;

    for (const assignment of assignments) {
      const members = assignment.memberIds.map(id => enrolled.get(id)!);
      const group = existing.get(assignment.id) ?? groups().create({ name: `Groupe ${nextNumber++}`, project });
      group.members = members;
      toSave.push(group);
    }
    for (const group of project.groups) {
      if (!payloadIds.has(group.id) && group.members.length > 0) {
        group.members = [];
        toSave.push(group);
      }
    }
    await groups().save(toSave);

    return {
      message: 'Répartition des groupes enregistrée',
      updatedGroups: assignments.length,
      affectedLinks: assignments.reduce((total, assignment) => total + assignment.memberIds.length, 0),
    };
  }

  private assertFreeFormationOpen(project: Project, verb = 'rejoindre') {
    if (project.groupFormationRule !== 'free') {
      throw forbidden(verb === 'quitter'
        ? "Les groupes de ce projet sont constitués par votre enseignant : contactez-le pour en changer"
        : "Ce projet n'autorise pas l'inscription libre dans les groupes");
    }
    if (project.groupFormationDeadline && new Date() > project.groupFormationDeadline) {
      throw forbidden('La date limite de formation des groupes est dépassée');
    }
  }

  /** « Groupe N » avec N supérieur à tous les numéros déjà utilisés (les suppressions laissent des trous). */
  private async saveNewGroup(project: Project, members: User[]) {
    const used = (project.groups ?? []).map(group => Number(/^Groupe (\d+)$/.exec(group.name)?.[1] ?? 0));
    const name = `Groupe ${Math.max(0, ...used, (project.groups ?? []).length) + 1}`;
    return groups().save(groups().create({ name, project, members }));
  }
}
