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
  location?: string | null;
}

const BREAK_MINUTES = 5;
const MINUTE_MS = 60_000;
const DEFAULT_DURATION_MINUTES = 30;
const MIN_DURATION_MINUTES = 10;

const defenses = () => AppDataSource.getRepository(Defense);
const groups = () => AppDataSource.getRepository(Group);

const listDefenses = (projectId: number) =>
  defenses().find({ where: { project: { id: projectId } }, relations: ['group'], order: { orderIndex: 'ASC' } });

export class DefenseService {
  /** Planifie une soutenance par groupe ; remplace le planning existant. */
  async schedule(projectId: number, teacherId: number, input: ScheduleInput) {
    const project = await findOwnedProject(projectId, teacherId);
    const projectGroups = await groups().find({ where: { project: { id: projectId } }, order: { id: 'ASC' } });
    if (projectGroups.length === 0) throw badRequest("Créez d'abord des groupes pour planifier les soutenances");

    const start = new Date(input.startDateTime);
    const end = input.endDateTime ? new Date(input.endDateTime) : null;
    if (end && end <= start) throw badRequest('La date de fin doit suivre la date de début');
    const duration = input.durationPerGroup
      ?? (end ? Math.max(MIN_DURATION_MINUTES, Math.floor((end.getTime() - start.getTime()) / MINUTE_MS / projectGroups.length)) : DEFAULT_DURATION_MINUTES);

    const slots = projectGroups.map((group, index) => {
      const startTime = new Date(start.getTime() + index * (duration + BREAK_MINUTES) * MINUTE_MS);
      return defenses().create({
        project,
        group,
        startTime,
        endTime: new Date(startTime.getTime() + duration * MINUTE_MS),
        orderIndex: index + 1,
        location: input.location || null,
      });
    });

    await defenses().remove(await listDefenses(projectId));
    await defenses().save(slots);
    return { message: 'Soutenances planifiées', defenses: (await listDefenses(projectId)).map(serializeDefense) };
  }

  async reorder(projectId: number, teacherId: number, newOrder: { groupId: number; orderIndex: number }[]) {
    await findOwnedProject(projectId, teacherId);
    const current = await listDefenses(projectId);

    const changed = newOrder.flatMap(({ groupId, orderIndex }) => {
      const defense = current.find(item => item.group.id === groupId);
      if (!defense) return [];
      defense.orderIndex = orderIndex;
      return [defense];
    });
    await defenses().save(changed);
    return { defenses: (await listDefenses(projectId)).map(serializeDefense) };
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
