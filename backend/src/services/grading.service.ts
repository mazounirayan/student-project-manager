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

export interface PublicationScope {
  groupId?: number;
  gridId?: number;
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

/** Note moyenne pondérée par le poids de chaque grille ; à poids tous nuls, chaque grille compte autant. */
export function weightedFinalGrade(items: { score: number; weight: number }[]): number | null {
  if (items.length === 0) return null;
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  if (totalWeight <= 0) return round(items.reduce((sum, item) => sum + item.score, 0) / items.length);
  return round(items.reduce((sum, item) => sum + item.score * item.weight, 0) / totalWeight);
}

const isPublished = (grade: Grade) => grade.status === 'validated' && Boolean(grade.publishedAt);

/** Note sur 20 : moyenne des critères notés, pondérée par le poids de chaque critère. */
export function computeTotalScore(gridCriteria: GradingCriterion[], entries: { criterionId: number; score: number }[]): number {
  let weighted = 0;
  let totalWeight = 0;
  for (const entry of entries) {
    const criterion = gridCriteria.find(item => item.id === entry.criterionId);
    if (!criterion) continue;
    weighted += (Math.min(entry.score, criterion.maxScore) / criterion.maxScore) * MAX_GRADE * criterion.weight;
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
    const saved = await criteria().save(criterion);
    await this.recomputeTotals(criterion.gradingGrid.id);
    return serializeCriterion(saved);
  }

  async deleteCriterion(id: number, teacherId: number): Promise<void> {
    const criterion = await this.findOwnedCriterion(id, teacherId);
    await criteria().remove(criterion);
    await this.recomputeTotals(criterion.gradingGrid.id);
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

  /**
   * Publie les notes validées du projet (ou d'un groupe, ou d'une grille) : elles deviennent visibles des
   * étudiants. Les brouillons ne sont jamais publiés.
   */
  async publishGrades(projectId: number, teacherId: number, scope: PublicationScope = {}): Promise<{ published: number }> {
    await findOwnedProject(projectId, teacherId);
    const candidates = await grades().find({
      where: {
        gradingGrid: { project: { id: projectId }, ...(scope.gridId && { id: scope.gridId }) },
        ...(scope.groupId && { group: { id: scope.groupId } }),
        status: 'validated' as const,
      },
    });
    const now = new Date();
    const toPublish = candidates.filter(grade => !grade.publishedAt);
    await grades().save(toPublish.map(grade => {
      grade.publishedAt = now;
      return grade;
    }));
    return { published: toPublish.length };
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
   * uniquement les notes publiées de ses propres groupes pour un étudiant.
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
    return found.filter(grade => !isStudent || isPublished(grade)).map(serializeSession);
  }

  /** Notes publiées des groupes de l'étudiant, avec le détail des critères. */
  async getStudentGrades(studentId: number) {
    const found = await grades().find({
      where: { status: 'validated', group: { members: { id: studentId } } },
      relations: ['gradingGrid', 'gradingGrid.project', 'gradingGrid.criteria', 'group', 'criterionGrades', 'criterionGrades.criterion'],
      order: { publishedAt: 'DESC' },
    });

    return found.filter(isPublished).map(grade => ({
      id: grade.id,
      projectId: grade.gradingGrid.project.id,
      projectName: grade.gradingGrid.project.name,
      groupId: grade.group.id,
      groupName: grade.group.name,
      gridId: grade.gradingGrid.id,
      type: grade.gradingGrid.type,
      title: grade.gradingGrid.name,
      grade: grade.totalScore ?? 0,
      maxGrade: MAX_GRADE,
      feedback: grade.globalComments || null,
      gradedAt: grade.publishedAt,
      criteria: grade.criterionGrades.map(entry => ({
        name: entry.criterion.name,
        score: entry.score,
        maxScore: entry.criterion.maxScore,
        comments: entry.comments || null,
        weight: entry.criterion.weight,
      })),
    }));
  }

  /**
   * Avancement de la notation vu par l'étudiant, projet par projet : évaluations publiées ou pas encore,
   * part de chacune dans la note finale et note finale calculée sur les seules notes publiées.
   * Ne révèle rien des brouillons ni des notes validées mais non publiées.
   */
  async getStudentOverview(studentId: number) {
    const studentGroups = await AppDataSource.getRepository(Group).find({
      where: { members: { id: studentId } },
      relations: ['project'],
    });

    const rows = [];
    for (const group of studentGroups) {
      if (group.project.status !== 'visible') continue;
      const [projectGrids, groupGrades] = await Promise.all([
        grids().find({ where: { project: { id: group.project.id } }, order: { createdAt: 'ASC' } }),
        grades().find({ where: { group: { id: group.id }, status: 'validated' }, relations: ['gradingGrid'] }),
      ]);
      if (projectGrids.length === 0) continue;

      const totalWeight = projectGrids.reduce((sum, grid) => sum + grid.weight, 0);
      const evaluations = projectGrids.map(grid => {
        const published = groupGrades.find(grade => grade.gradingGrid.id === grid.id && isPublished(grade));
        return {
          gridId: grid.id,
          title: grid.name,
          type: grid.type,
          share: totalWeight > 0 ? grid.weight / totalWeight : 1 / projectGrids.length,
          published: Boolean(published),
          grade: published ? published.totalScore ?? 0 : null,
        };
      });
      const publishedItems = evaluations.flatMap(item => item.grade === null ? [] : [{ score: item.grade, weight: item.share }]);

      rows.push({
        projectId: group.project.id,
        projectName: group.project.name,
        groupId: group.id,
        groupName: group.name,
        finalGrade: weightedFinalGrade(publishedItems),
        complete: publishedItems.length === evaluations.length,
        evaluations,
      });
    }
    return rows;
  }

  /**
   * Suivi de la notation d'un projet : une ligne par groupe, une note par grille. La note finale ne retient que
   * les notes validées (ou publiées) : un brouillon n'entre pas dans le calcul.
   */
  async getProjectSummary(projectId: number, teacherId: number) {
    const project = await findOwnedProject(projectId, teacherId);
    const [projectGrids, groups, projectGrades] = await Promise.all([
      grids().find({ where: { project: { id: projectId } }, order: { createdAt: 'ASC' } }),
      AppDataSource.getRepository(Group).find({ where: { project: { id: projectId } }, relations: ['members'], order: { id: 'ASC' } }),
      grades().find({ where: { gradingGrid: { project: { id: projectId } } }, relations: ['gradingGrid', 'group'] }),
    ]);

    const gridSummaries = projectGrids.map(grid => ({
      id: grid.id, name: grid.name, type: grid.type, weight: grid.weight, deliverableId: grid.deliverableId ?? null,
    }));
    const groupRows = groups.map(group => {
      const groupGrades = projectGrades.filter(grade => grade.group.id === group.id);
      const final = weightedFinalGrade(groupGrades
        .filter(grade => grade.status === 'validated')
        .map(grade => ({ score: grade.totalScore ?? 0, weight: grade.gradingGrid.weight })));
      return {
        id: group.id,
        name: group.name,
        members: group.members.map(({ id, firstName, lastName, email }) => ({ id, firstName, lastName, email })),
        grades: groupGrades.map(grade => ({
          id: grade.id,
          gridId: grade.gradingGrid.id,
          gridName: grade.gradingGrid.name,
          totalScore: grade.totalScore ?? 0,
          status: grade.status,
          isValidated: grade.status === 'validated',
          isPublished: isPublished(grade),
        })),
        finalGrade: final,
      };
    });

    return { project: { id: project.id, name: project.name }, gradingGrids: gridSummaries, groups: groupRows };
  }

  /** Export CSV (séparateur « ; », BOM UTF-8 pour Excel) des notes validées ; un brouillon est signalé comme tel. */
  async exportProjectGrades(projectId: number, teacherId: number): Promise<string> {
    const summary = await this.getProjectSummary(projectId, teacherId);
    const header = ['Groupe', 'Étudiants', ...summary.gradingGrids.map(grid => grid.name), 'Note finale'];
    const rows = summary.groups.map(group => [
      group.name,
      group.members.map(member => `${member.firstName} ${member.lastName}`).join(', '),
      ...summary.gradingGrids.map(grid => {
        const grade = group.grades.find(item => item.gridId === grid.id);
        if (!grade) return 'Non noté';
        return grade.isValidated ? grade.totalScore.toFixed(2).replace('.', ',') : 'Brouillon';
      }),
      group.finalGrade === null ? '' : group.finalGrade.toFixed(2).replace('.', ','),
    ]);
    return `\ufeff${[header, ...rows].map(row => row.map(csvCell).join(';')).join('\r\n')}\r\n`;
  }

  // ----- Utilitaires -----

  /** Modifier ou retirer un critère change le total des notes déjà saisies : on les recalcule. */
  private async recomputeTotals(gridId: number) {
    const grid = await grids().findOne({ where: { id: gridId }, relations: ['criteria'] });
    if (!grid) return;
    const saved = await grades().find({ where: { gradingGrid: { id: gridId } }, relations: ['criterionGrades', 'criterionGrades.criterion'] });
    await grades().save(saved.map(grade => {
      grade.totalScore = computeTotalScore(grid.criteria, grade.criterionGrades.map(entry => ({ criterionId: entry.criterion.id, score: entry.score })));
      return grade;
    }));
  }

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

    const status = input.status ?? grade.status ?? 'draft';
    if (status === 'validated') assertReadyToValidate(grid, input.entries);

    const previousEntries = new Map((grade.criterionGrades ?? []).map(entry => [entry.criterion.id, entry]));
    grade.criterionGrades = input.entries.map(entry => {
      const criterion = byCriterion.get(Number(entry.criterionId))!;
      const target = previousEntries.get(criterion.id) ?? new CriterionGrade();
      return Object.assign(target, { score: Number(entry.score), comments: entry.comment || null, criterion });
    });

    grade.totalScore = computeTotalScore(grid.criteria, input.entries.map(entry => ({ criterionId: Number(entry.criterionId), score: Number(entry.score) })));
    grade.globalComments = input.globalComment ?? grade.globalComments ?? null;
    grade.status = status;
    grade.validatedAt = status === 'validated' ? grade.validatedAt ?? new Date() : null;
    // Rouvrir une note (la repasser en brouillon) la retire aussi de la vue des étudiants.
    grade.publishedAt = status === 'validated' ? grade.publishedAt ?? null : null;
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

/** Une note ne peut être validée que complète : chaque critère noté, et un commentaire là où il est attendu. */
function assertReadyToValidate(grid: GradingGrid, entries: SessionInput['entries']) {
  const missing = grid.criteria.filter(criterion => !entries.some(entry => Number(entry.criterionId) === criterion.id));
  if (missing.length > 0) {
    throw badRequest(`Il reste ${missing.length} critère${missing.length > 1 ? 's' : ''} sans note : ${missing.map(item => `« ${item.name} »`).join(', ')}`);
  }
  const uncommented = grid.criteria.filter(criterion => criterion.hasComments
    && !entries.find(entry => Number(entry.criterionId) === criterion.id)?.comment?.trim());
  if (uncommented.length > 0) {
    throw badRequest(`Un commentaire est attendu pour : ${uncommented.map(item => `« ${item.name} »`).join(', ')}`);
  }
}

/** Échappe une cellule CSV et neutralise les formules interprétées par les tableurs. */
function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[;"\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
