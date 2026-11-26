import { AppDataSource } from '../database/data-source';
import { DeliverableSubmission, Project, Promotion } from '../entities/Entities';
import { badRequest, forbidden } from '../utils/http-error';
import { pick } from '../utils/pick';
import { EmailService } from '../utils/email.service';
import { removeUploadedFile } from '../middleware/upload.middleware';
import {
  serializeDefense, serializeDeliverable, serializeGrid, serializeGroup, serializeReport,
} from '../serializers';
import { Actor, findOwnedProject, findProjectForActor, findStudentGroup } from './access.service';

export interface ProjectInput {
  name?: string;
  description?: string;
  status?: 'draft' | 'visible';
  promotionId?: number;
  minGroupSize?: number | null;
  maxGroupSize?: number | null;
  groupFormationRule?: 'manual' | 'random' | 'free' | null;
  groupFormationDeadline?: Date | string | null;
}

const EDITABLE_FIELDS = [
  'name', 'description', 'status', 'minGroupSize', 'maxGroupSize', 'groupFormationRule', 'groupFormationDeadline',
] as const;

/** Le formulaire envoie une chaîne vide quand aucune date limite n'est choisie. */
const editableFields = (data: ProjectInput) => {
  const fields = pick(data, EDITABLE_FIELDS);
  if ('groupFormationDeadline' in fields && !fields.groupFormationDeadline) fields.groupFormationDeadline = null;
  return fields;
};

const projects = () => AppDataSource.getRepository(Project);

function summarize(project: Project) {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    minGroupSize: project.minGroupSize,
    maxGroupSize: project.maxGroupSize,
    groupFormationRule: project.groupFormationRule,
    groupFormationDeadline: project.groupFormationDeadline,
    promotionId: project.promotion?.id ?? project.promotionId,
    promotionName: project.promotion?.name,
    teacherName: project.teacher ? `${project.teacher.firstName} ${project.teacher.lastName}` : undefined,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

export class ProjectService {
  private emailService = new EmailService();

  async createProject(teacherId: number, data: ProjectInput) {
    const promotion = await this.findTeacherPromotion(Number(data.promotionId), teacherId);
    this.assertGroupSizes(data);

    const project = await projects().save(projects().create({
      ...editableFields(data),
      promotion,
      promotionId: promotion.id,
      teacher: { id: teacherId },
    }));
    if (project.status === 'visible') await this.notifyStudents(project, promotion);
    return summarize({ ...project, promotion });
  }

  async updateProject(id: number, teacherId: number, data: ProjectInput) {
    const project = await findOwnedProject(id, teacherId, ['promotion', 'promotion.students']);
    const wasVisible = project.status === 'visible';
    this.assertGroupSizes({
      minGroupSize: data.minGroupSize !== undefined ? data.minGroupSize : project.minGroupSize,
      maxGroupSize: data.maxGroupSize !== undefined ? data.maxGroupSize : project.maxGroupSize,
    });

    Object.assign(project, editableFields(data));
    if (data.promotionId !== undefined && Number(data.promotionId) !== project.promotionId) {
      project.promotion = await this.findTeacherPromotion(Number(data.promotionId), teacherId);
      project.promotionId = project.promotion.id;
    }

    const saved = await projects().save(project);
    if (!wasVisible && saved.status === 'visible') await this.notifyStudents(saved, project.promotion);
    return summarize(saved);
  }

  async deleteProject(id: number, teacherId: number): Promise<void> {
    const project = await findOwnedProject(id, teacherId);
    const submissions = await AppDataSource.getRepository(DeliverableSubmission).find({
      where: { deliverable: { project: { id } } },
    });
    await projects().remove(project);
    submissions.forEach(submission => submission.filePath && removeUploadedFile({ path: submission.filePath }));
  }

  async getMyProjects(actor: Actor) {
    if (actor.role === 'teacher') {
      const list = await projects().find({
        where: { teacher: { id: actor.id } },
        relations: ['teacher', 'promotion', 'promotion.students', 'groups', 'groups.members', 'deliverables'],
        order: { createdAt: 'DESC' },
      });
      return list.map(project => this.serializeListItem(project, true));
    }

    const list = await projects().find({
      where: { status: 'visible', promotion: { students: { id: actor.id } } },
      relations: ['teacher', 'promotion', 'groups', 'groups.members', 'deliverables'],
      order: { createdAt: 'DESC' },
    });
    return list.map(project => this.serializeListItem(project, false));
  }

  /** Détail d'un projet : complet pour son enseignant, limité à son propre groupe pour un étudiant. */
  async getProjectDetail(id: number, actor: Actor) {
    const relations = [
      'teacher', 'promotion', 'groups', 'groups.members', 'deliverables', 'deliverables.validationRules',
      'deliverables.submissions', 'deliverables.submissions.group', 'reports', 'reports.group', 'reports.sections',
      'reports.sections.sectionConfig', 'defenses', 'defenses.group',
    ];
    const project = await findProjectForActor(id, actor, actor.role === 'teacher'
      ? [...relations, 'promotion.students', 'gradingGrids', 'gradingGrids.criteria']
      : relations);

    const ownGroupId = actor.role === 'student' ? (await findStudentGroup(id, actor.id))?.id : undefined;
    const visibleToActor = <T extends { group?: { id: number } }>(items: T[]) =>
      actor.role === 'teacher' ? items : items.filter(item => item.group?.id === ownGroupId);

    return {
      ...summarize(project),
      promotion: project.promotion && {
        id: project.promotion.id,
        name: project.promotion.name,
        ...(actor.role === 'teacher' && { students: project.promotion.students }),
      },
      teacher: project.teacher,
      groups: project.groups.map(serializeGroup),
      deliverables: project.deliverables.map(deliverable =>
        serializeDeliverable(deliverable, visibleToActor(deliverable.submissions), actor.role === 'teacher')),
      reports: visibleToActor(project.reports).map(serializeReport),
      defenses: [...project.defenses].sort((a, b) => a.orderIndex - b.orderIndex).map(serializeDefense),
      gradingGrids: actor.role === 'teacher' ? project.gradingGrids.map(serializeGrid) : undefined,
    };
  }

  private serializeListItem(project: Project, isOwner: boolean) {
    return {
      ...summarize(project),
      promotion: project.promotion && {
        id: project.promotion.id,
        name: project.promotion.name,
        ...(isOwner && { students: project.promotion.students }),
      },
      groups: project.groups.map(serializeGroup),
      deliverables: project.deliverables.map(deliverable => serializeDeliverable(deliverable, [])),
    };
  }

  private async findTeacherPromotion(promotionId: number, teacherId: number): Promise<Promotion> {
    const promotion = await AppDataSource.getRepository(Promotion).findOne({
      where: { id: promotionId },
      relations: ['teacher', 'students'],
    });
    if (!promotion) throw badRequest('Promotion introuvable');
    if (promotion.teacher?.id !== teacherId) throw forbidden('Cette promotion appartient à un autre enseignant');
    return promotion;
  }

  private assertGroupSizes({ minGroupSize, maxGroupSize }: ProjectInput) {
    if (minGroupSize && maxGroupSize && minGroupSize > maxGroupSize) {
      throw badRequest('La taille minimale des groupes dépasse la taille maximale');
    }
  }

  private async notifyStudents(project: Project, promotion: Promotion): Promise<void> {
    await Promise.allSettled((promotion.students ?? []).map(student =>
      this.emailService.sendProjectNotificationEmail(student.email, project.name, project.description)));
  }
}
