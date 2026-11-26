import { AppDataSource } from '../database/data-source';
import { Defense, Group } from '../entities/Entities';
import { badRequest } from '../utils/http-error';
import { serializeDefense } from '../serializers';
import { PDFGeneratorService } from '../utils/pdf-generator.service';
import { findOwnedProject } from './access.service';

export interface ScheduleInput {
  startDateTime: string;
  endDateTime?: string | null;
  durationPerGroup?: number | null;
  /** Pause entre deux groupes, en minutes. */
  breakMinutes?: number | null;
  location?: string | null;
  /** Ce que les étudiants doivent préparer ; non fourni, on garde celui du planning actuel. */
  instructions?: string | null;
}

const DEFAULT_BREAK_MINUTES = 5;
const MINUTE_MS = 60_000;
const DEFAULT_DURATION_MINUTES = 30;
const MIN_DURATION_MINUTES = 10;

const defenses = () => AppDataSource.getRepository(Defense);
const groups = () => AppDataSource.getRepository(Group);

/** Dans l'ordre des créneaux : l'ordre de passage suit toujours l'heure de passage. */
const bySlot = (a: Defense, b: Defense) => a.startTime.getTime() - b.startTime.getTime() || a.orderIndex - b.orderIndex;

const listDefenses = async (projectId: number) =>
  (await defenses().find({ where: { project: { id: projectId } }, relations: ['group'] })).sort(bySlot);

/** Une soutenance commencée (en cours ou passée) ne se déplace plus. */
const hasStarted = (defense: Defense, now: number) => defense.startTime.getTime() <= now;

/** Numérote les soutenances de 1 à n selon l'heure de passage. */
async function renumber(projectId: number) {
  const all = await listDefenses(projectId);
  const changed = all.filter((defense, index) => defense.orderIndex !== index + 1);
  changed.forEach(defense => { defense.orderIndex = all.indexOf(defense) + 1; });
  if (changed.length > 0) await defenses().save(changed);
  return all;
}

export class DefenseService {
  /**
   * Planifie une soutenance par groupe, dans l'ordre actuel (puis les nouveaux groupes à la suite).
   * Les soutenances déjà commencées sont conservées : seuls les autres groupes sont replanifiés.
   */
  async schedule(projectId: number, teacherId: number, input: ScheduleInput) {
    const project = await findOwnedProject(projectId, teacherId);
    const projectGroups = (await groups().find({ where: { project: { id: projectId } }, relations: ['members'], order: { id: 'ASC' } }))
      .filter(group => (group.members?.length ?? 0) > 0)
      .sort((a, b) => a.id - b.id);
    if (projectGroups.length === 0) throw badRequest("Constituez d'abord des groupes d'étudiants pour planifier les soutenances");

    const start = new Date(input.startDateTime);
    if (Number.isNaN(start.getTime())) throw badRequest('Date de début invalide');
    const end = input.endDateTime ? new Date(input.endDateTime) : null;
    if (end && end <= start) throw badRequest('La date de fin doit suivre la date de début');
    const duration = input.durationPerGroup
      ?? (end ? Math.max(MIN_DURATION_MINUTES, Math.floor((end.getTime() - start.getTime()) / MINUTE_MS / projectGroups.length)) : DEFAULT_DURATION_MINUTES);
    const pause = input.breakMinutes ?? DEFAULT_BREAK_MINUTES;

    const existing = await listDefenses(projectId);
    const now = Date.now();
    const finished = existing.filter(defense => hasStarted(defense, now));
    const finishedGroups = new Set(finished.map(defense => defense.group.id));
    const upcoming = existing.filter(defense => !finished.includes(defense));
    const position = new Map(upcoming.map((defense, index) => [defense.group.id, index]));

    const toSchedule = projectGroups
      .filter(group => !finishedGroups.has(group.id))
      .sort((a, b) => (position.get(a.id) ?? Infinity) - (position.get(b.id) ?? Infinity) || a.id - b.id);
    if (toSchedule.length === 0) throw badRequest('Toutes les soutenances ont déjà commencé ou eu lieu : il n\'y a plus rien à planifier');

    const instructions = input.instructions === undefined
      ? existing.find(defense => defense.instructions)?.instructions ?? null
      : input.instructions?.trim() || null;

    const slots = toSchedule.map((group, index) => {
      const startTime = new Date(start.getTime() + index * (duration + pause) * MINUTE_MS);
      return defenses().create({
        project,
        group,
        startTime,
        endTime: new Date(startTime.getTime() + duration * MINUTE_MS),
        orderIndex: finished.length + index + 1,
        location: input.location || null,
        instructions,
      });
    });

    await defenses().remove(upcoming);
    await defenses().save(slots);
    return { message: 'Soutenances planifiées', defenses: (await renumber(projectId)).map(serializeDefense) };
  }

  /**
   * Change l'ordre de passage : chaque groupe prend le créneau (heure, durée) de sa nouvelle place.
   * Une soutenance commencée ou passée reste à sa place.
   */
  async reorder(projectId: number, teacherId: number, newOrder: { groupId: number; orderIndex: number }[]) {
    await findOwnedProject(projectId, teacherId);
    const current = await listDefenses(projectId);
    if (current.length === 0) throw badRequest("Aucune soutenance n'est planifiée");

    const requested = new Map(newOrder.map(({ groupId, orderIndex }) => [groupId, orderIndex]));
    const wanted = (defense: Defense) => requested.get(defense.group.id) ?? current.indexOf(defense) + 1;
    const next = [...current].sort((a, b) => wanted(a) - wanted(b) || current.indexOf(a) - current.indexOf(b));

    const now = Date.now();
    if (current.some((defense, index) => hasStarted(defense, now) && next[index] !== defense)) {
      throw badRequest('Une soutenance commencée ou passée ne peut plus être déplacée');
    }

    const slots = current.map(({ startTime, endTime }) => ({ startTime, endTime }));
    next.forEach((defense, index) => Object.assign(defense, slots[index], { orderIndex: index + 1 }));
    await defenses().save(next);
    return { defenses: next.map(serializeDefense) };
  }

  async schedulePdf(projectId: number, teacherId: number): Promise<Buffer> {
    const project = await findOwnedProject(projectId, teacherId);
    return PDFGeneratorService.generateDefenseSchedule(await listDefenses(projectId), project.name);
  }

  async attendancePdf(projectId: number, teacherId: number, orderType: 'group' | 'alphabetical'): Promise<Buffer> {
    const project = await findOwnedProject(projectId, teacherId);
    const projectGroups = await groups().find({ where: { project: { id: projectId } }, relations: ['members'] });
    return PDFGeneratorService.generateAttendanceSheet(projectGroups, project.name, orderType);
  }
}
