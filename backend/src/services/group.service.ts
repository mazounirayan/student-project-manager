import { AppDataSource } from '../database/data-source';
import { Group, User } from '../entities/Entities';
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

  async joinGroup(groupId: number, studentId: number) {
    const group = await groups().findOne({ where: { id: groupId }, relations: ['project', 'project.promotion', 'members'] });
    if (!group) throw notFound('Groupe introuvable');

    const project = await findProjectForActor(group.project.id, { id: studentId, role: 'student' });
    if (project.groupFormationRule !== 'free') throw forbidden("Ce projet n'autorise pas l'inscription libre dans les groupes");
    if (project.groupFormationDeadline && new Date() > project.groupFormationDeadline) {
      throw forbidden('La date limite de formation des groupes est dépassée');
    }
    if (project.maxGroupSize && group.members.length >= project.maxGroupSize) throw forbidden('Ce groupe est complet');
    if (await findStudentGroup(project.id, studentId)) throw conflict('Vous appartenez déjà à un groupe de ce projet');

    const student = await AppDataSource.getRepository(User).findOneByOrFail({ id: studentId });
    group.members.push(student);
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
}
