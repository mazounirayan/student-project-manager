import { FindOptionsWhere } from 'typeorm';
import { AppDataSource } from '../database/data-source';
import {
  CriterionGrade, Deliverable, Grade, GradeStatus, GradingCriterion, GradingGrid, Group, GridType,
} from '../entities/Entities';
import { badRequest, forbidden, notFound } from '../utils/http-error';
import { pick } from '../utils/pick';
import { serializeCriterion, serializeGrid, serializeSession } from '../serializers';
import { Actor, findOwnedProject } from './access.service';

export interface GridInput {
  projectId?: number;
  name?: string;
  type?: GridType;
  weight?: number;
  description?: string | null;
  deliverableId?: number | null;
}

export interface CriterionInput {
  name?: string;
  description?: string | null;
  maxScore?: number;
  weight?: number;
  type?: 'group' | 'individual';
  hasComments?: boolean;
}

export interface SessionInput {
  gridId?: number;
  groupId?: number;
  entries: { criterionId: number; score: number; comment?: string | null }[];
  globalComment?: string | null;
  status?: GradeStatus;
}

export interface SessionFilters {
  gridId?: number;
  groupId?: number;
  projectId?: number;
  type?: GridType;
}

const GRID_FIELDS = ['name', 'type', 'weight', 'description', 'deliverableId'] as const;
const CRITERION_FIELDS = ['name', 'description', 'maxScore', 'weight', 'type', 'hasComments'] as const;
const MAX_GRADE = 20;

const grids = () => AppDataSource.getRepository(GradingGrid);
const criteria = () => AppDataSource.getRepository(GradingCriterion);
const grades = () => AppDataSource.getRepository(Grade);

const round = (value: number) => Math.round(value * 100) / 100;

/** Note sur 20 : moyenne des critères notés, pondérée par le poids de chaque critère. */
export function computeTotalScore(gridCriteria: GradingCriterion[], entries: { criterionId: number; score: number }[]): number {
  let weighted = 0;
  let totalWeight = 0;
  for (const entry of entries) {
    const criterion = gridCriteria.find(item => item.id === entry.criterionId);
    if (!criterion) continue;
    weighted += (entry.score / criterion.maxScore) * MAX_GRADE * criterion.weight;
    totalWeight += criterion.weight;
  }
  return totalWeight > 0 ? round(weighted / totalWeight) : 0;
}

export class GradingService {
  // ----- Grilles et critères (enseignant propriétaire du projet) -----

  async createGrid(teacherId: number, data: GridInput) {
    const project = await findOwnedProject(Number(data.projectId), teacherId);
    await this.assertDeliverableInProject(data.deliverableId, project.id);
    const grid = await grids().save(grids().create({ ...pick(data, GRID_FIELDS), project }));
    return serializeGrid({ ...grid, project, criteria: [] });
  }

  async updateGrid(id: number, teacherId: number, data: GridInput) {
    const grid = await this.findOwnedGrid(id, teacherId, ['criteria']);
    await this.assertDeliverableInProject(data.deliverableId, grid.project.id);
    Object.assign(grid, pick(data, GRID_FIELDS));
    return serializeGrid(await grids().save(grid));
  }

  async deleteGrid(id: number, teacherId: number): Promise<void> {
    await grids().remove(await this.findOwnedGrid(id, teacherId));
  }

  async listProjectGrids(projectId: number, teacherId: number, type?: GridType) {
    await findOwnedProject(projectId, teacherId);
    const list = await grids().find({
      where: { project: { id: projectId }, ...(type && { type }) },
      relations: ['project', 'criteria'],
      order: { createdAt: 'ASC' },
    });
    return list.map(serializeGrid);
  }

  async addCriterion(gridId: number, teacherId: number, data: CriterionInput) {
    const grid = await this.findOwnedGrid(gridId, teacherId);
    const criterion = await criteria().save(criteria().create({ ...pick(data, CRITERION_FIELDS), gradingGrid: grid }));
    return serializeCriterion(criterion, grid.id);
  }

  async updateCriterion(id: number, teacherId: number, data: CriterionInput) {
    const criterion = await this.findOwnedCriterion(id, teacherId);
    Object.assign(criterion, pick(data, CRITERION_FIELDS));
    return serializeCriterion(await criteria().save(criterion));
  }

  async deleteCriterion(id: number, teacherId: number): Promise<void> {
    await criteria().remove(await this.findOwnedCriterion(id, teacherId));
  }

  // ----- Saisie des notes (enseignant) -----

  async createSession(teacherId: number, input: SessionInput) {
    const grid = await this.findOwnedGrid(Number(input.gridId), teacherId, ['criteria']);
    const group = await AppDataSource.getRepository(Group).findOne({ where: { id: Number(input.groupId) }, relations: ['project'] });
    if (!group || group.project.id !== grid.project.id) throw badRequest('Ce groupe ne participe pas au projet de la grille');

    const existing = await grades().findOne({
      where: { gradingGrid: { id: grid.id }, group: { id: group.id } },
      relations: ['gradingGrid', 'group', 'criterionGrades', 'criterionGrades.criterion', 'gradedBy'],
    });
    return this.saveSession(existing ?? grades().create({ gradingGrid: grid, group, criterionGrades: [] }), grid, teacherId, input);
  }

  async updateSession(id: number, teacherId: number, input: SessionInput) {
    const grade = await grades().findOne({
      where: { id },
      relations: ['gradingGrid', 'group', 'criterionGrades', 'criterionGrades.criterion', 'gradedBy'],
    });
    if (!grade) throw notFound('Notation introuvable');
    const grid = await this.findOwnedGrid(grade.gradingGrid.id, teacherId, ['criteria']);
    return this.saveSession(grade, grid, teacherId, input);
  }

  /** Publie toutes les notes du projet : elles deviennent visibles des étudiants. */
  async validateProjectGrades(projectId: number, teacherId: number): Promise<void> {
    await findOwnedProject(projectId, teacherId);
    const pending = await grades().find({ where: { gradingGrid: { project: { id: projectId } } } });
    const now = new Date();
    await grades().save(pending.filter(grade => grade.status !== 'validated').map(grade => {
      grade.status = 'validated';
      grade.validatedAt = now;
      return grade;
    }));
  }

  async updateWeights(projectId: number, teacherId: number, weights: { id?: number; gridId?: number; weight: number }[]): Promise<void> {
    await findOwnedProject(projectId, teacherId);
    const projectGrids = await grids().find({ where: { project: { id: projectId } } });
    const updated = weights.flatMap(({ id, gridId, weight }) => {
      const grid = projectGrids.find(item => item.id === Number(id ?? gridId));
      if (!grid) return [];
      grid.weight = Number(weight);
      return [grid];
    });
    if (updated.length !== weights.length) throw badRequest("Une grille n'appartient pas à ce projet");
    await grids().save(updated);
  }

  // ----- Lecture -----

  /**
   * Notations visibles par l'utilisateur : celles de ses projets pour un enseignant,
   * uniquement les notes validées de ses propres groupes pour un étudiant.
   */
  async listSessions(actor: Actor, filters: SessionFilters) {
    const isStudent = actor.role === 'student';
    const projectWhere: FindOptionsWhere<GradingGrid['project']> = {
      ...(filters.projectId && { id: filters.projectId }),
      ...(!isStudent && { teacher: { id: actor.id } }),
    };
    const gridWhere: FindOptionsWhere<GradingGrid> = {
      ...(filters.gridId && { id: filters.gridId }),
      ...(filters.type && { type: filters.type }),
      ...(Object.keys(projectWhere).length > 0 && { project: projectWhere }),
    };
    const groupWhere: FindOptionsWhere<Group> = {
      ...(filters.groupId && { id: filters.groupId }),
      ...(isStudent && { members: { id: actor.id } }),
    };

    const found = await grades().find({
      where: {
        ...(Object.keys(gridWhere).length > 0 && { gradingGrid: gridWhere }),
        ...(Object.keys(groupWhere).length > 0 && { group: groupWhere }),
        ...(isStudent && { status: 'validated' as const }),
      },
      relations: ['gradingGrid', 'group', 'criterionGrades', 'criterionGrades.criterion', 'gradedBy'],
      order: { id: 'ASC' },
    });
    return found.map(serializeSession);
  }

  /** Notes validées des groupes de l'étudiant, avec le détail des critères. */
  async getStudentGrades(studentId: number) {
    const found = await grades().find({
      where: { status: 'validated', group: { members: { id: studentId } } },
      relations: ['gradingGrid', 'gradingGrid.project', 'gradingGrid.criteria', 'group', 'criterionGrades', 'criterionGrades.criterion'],
      order: { validatedAt: 'DESC' },
    });

    return found.map(grade => ({
      id: grade.id,
      projectId: grade.gradingGrid.project.id,
      projectName: grade.gradingGrid.project.name,
      groupId: grade.group.id,
      groupName: grade.group.name,
      type: grade.gradingGrid.type,
      title: grade.gradingGrid.name,
      grade: grade.totalScore ?? 0,
      maxGrade: MAX_GRADE,
      feedback: grade.globalComments || null,
      gradedAt: grade.validatedAt ?? grade.updatedAt,
      criteria: grade.criterionGrades.map(entry => ({
        name: entry.criterion.name,
        score: entry.score,
        maxScore: entry.criterion.maxScore,
        comments: entry.comments || null,
        weight: entry.criterion.weight,
      })),
    }));
  }

  async getProjectSummary(projectId: number, teacherId: number) {
    const project = await findOwnedProject(projectId, teacherId);
    const [projectGrids, groups, projectGrades] = await Promise.all([
      grids().find({ where: { project: { id: projectId } }, order: { createdAt: 'ASC' } }),
      AppDataSource.getRepository(Group).find({ where: { project: { id: projectId } }, relations: ['members'], order: { id: 'ASC' } }),
      grades().find({ where: { gradingGrid: { project: { id: projectId } } }, relations: ['gradingGrid', 'group'] }),
    ]);

    const gridSummaries = projectGrids.map(grid => ({ id: grid.id, name: grid.name, type: grid.type, weight: grid.weight }));
    const groupRows = groups.map(group => {
      const groupGrades = projectGrades.filter(grade => grade.group.id === group.id);
      const totalWeight = groupGrades.reduce((sum, grade) => sum + grade.gradingGrid.weight, 0);
      const weighted = groupGrades.reduce((sum, grade) => sum + (grade.totalScore ?? 0) * grade.gradingGrid.weight, 0);
      return {
        id: group.id,
        name: group.name,
        members: group.members.map(({ id, firstName, lastName, email }) => ({ id, firstName, lastName, email })),
        grades: groupGrades.map(grade => ({
          id: grade.id,
          gridId: grade.gradingGrid.id,
          gridName: grade.gradingGrid.name,
          totalScore: grade.totalScore ?? 0,
          isValidated: grade.status === 'validated',
        })),
        finalGrade: totalWeight > 0 ? round(weighted / totalWeight) : 0,
      };
    });

    return {
      project: { id: project.id, name: project.name },
      gradingGrids: gridSummaries,
      grids: gridSummaries,
      groups: groupRows,
      allValidated: groupRows.length > 0 && groupRows.every(row =>
        row.grades.length === gridSummaries.length && row.grades.every(grade => grade.isValidated)),
    };
  }

  /** Export CSV (séparateur « ; », BOM UTF-8 pour Excel). */
  async exportProjectGrades(projectId: number, teacherId: number): Promise<string> {
    const summary = await this.getProjectSummary(projectId, teacherId);
    const header = ['Groupe', 'Étudiants', ...summary.gradingGrids.map(grid => grid.name), 'Note finale'];
    const rows = summary.groups.map(group => [
      group.name,
      group.members.map(member => `${member.firstName} ${member.lastName}`).join(', '),
      ...summary.gradingGrids.map(grid => {
        const grade = group.grades.find(item => item.gridId === grid.id);
        return grade ? grade.totalScore.toFixed(2).replace('.', ',') : 'Non noté';
      }),
      group.finalGrade.toFixed(2).replace('.', ','),
    ]);
    return `﻿${[header, ...rows].map(row => row.map(csvCell).join(';')).join('\r\n')}\r\n`;
  }

  // ----- Utilitaires -----

  private async saveSession(grade: Grade, grid: GradingGrid, teacherId: number, input: SessionInput) {
    const byCriterion = new Map(grid.criteria.map(criterion => [criterion.id, criterion]));
    const seen = new Set<number>();
    for (const entry of input.entries) {
      const criterion = byCriterion.get(Number(entry.criterionId));
      if (!criterion) throw badRequest("Un critère n'appartient pas à cette grille");
      if (seen.has(criterion.id)) throw badRequest('Un critère est noté plusieurs fois');
      if (entry.score > criterion.maxScore) throw badRequest(`La note du critère « ${criterion.name} » dépasse ${criterion.maxScore}`);
      seen.add(criterion.id);
    }

    const previousEntries = new Map((grade.criterionGrades ?? []).map(entry => [entry.criterion.id, entry]));
    grade.criterionGrades = input.entries.map(entry => {
      const criterion = byCriterion.get(Number(entry.criterionId))!;
      const target = previousEntries.get(criterion.id) ?? new CriterionGrade();
      return Object.assign(target, { score: Number(entry.score), comments: entry.comment || null, criterion });
    });

    const status = input.status ?? grade.status ?? 'draft';
    grade.totalScore = computeTotalScore(grid.criteria, input.entries.map(entry => ({ criterionId: Number(entry.criterionId), score: Number(entry.score) })));
    grade.globalComments = input.globalComment ?? grade.globalComments ?? null;
    grade.status = status;
    grade.validatedAt = status === 'validated' ? grade.validatedAt ?? new Date() : null;
    grade.gradedBy = { id: teacherId } as Grade['gradedBy'];

    const saved = await grades().save(grade);
    const reloaded = await grades().findOneOrFail({
      where: { id: saved.id },
      relations: ['gradingGrid', 'group', 'criterionGrades', 'criterionGrades.criterion', 'gradedBy'],
    });
    return serializeSession(reloaded);
  }

  private async findOwnedGrid(id: number, teacherId: number, relations: string[] = []): Promise<GradingGrid> {
    const grid = await grids().findOne({ where: { id }, relations: ['project', 'project.teacher', ...relations] });
    if (!grid) throw notFound('Grille introuvable');
    if (grid.project.teacher?.id !== teacherId) throw forbidden('Cette grille appartient à un autre enseignant');
    return grid;
  }

  private async findOwnedCriterion(id: number, teacherId: number): Promise<GradingCriterion> {
    const criterion = await criteria().findOne({ where: { id }, relations: ['gradingGrid', 'gradingGrid.project', 'gradingGrid.project.teacher'] });
    if (!criterion) throw notFound('Critère introuvable');
    if (criterion.gradingGrid.project.teacher?.id !== teacherId) throw forbidden('Ce critère appartient à un autre enseignant');
    return criterion;
  }

  private async assertDeliverableInProject(deliverableId: number | null | undefined, projectId: number) {
    if (!deliverableId) return;
    const deliverable = await AppDataSource.getRepository(Deliverable).findOne({ where: { id: deliverableId, project: { id: projectId } } });
    if (!deliverable) throw badRequest("Ce livrable n'appartient pas au projet");
  }
}

/** Échappe une cellule CSV et neutralise les formules interprétées par les tableurs. */
function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[;"\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
