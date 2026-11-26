import { AppDataSource } from '../database/data-source';
import { Report, ReportConfig, ReportSection, ReportSectionConfig } from '../entities/Entities';
import { badRequest, conflict, forbidden, notFound } from '../utils/http-error';
import { PDFGeneratorService } from '../utils/pdf-generator.service';
import {
  serializeReport, serializeReportConfig, serializeReportSection, serializeSectionConfig,
} from '../serializers';
import { Actor, findGroupForActor, findOwnedProject, findProjectForActor } from './access.service';

export interface SectionConfigInput {
  id?: number;
  title: string;
  description?: string | null;
  required?: boolean;
  wordLimit?: number | null;
}

export interface ReportConfigInput {
  isEnabled?: boolean;
  format?: 'markdown' | 'html';
  deadline?: string | null;
  instructions?: string | null;
  sections?: SectionConfigInput[];
}

const REPORT_RELATIONS = ['project', 'group', 'sections', 'sections.sectionConfig'];

const configs = () => AppDataSource.getRepository(ReportConfig);
const sectionConfigs = () => AppDataSource.getRepository(ReportSectionConfig);
const reports = () => AppDataSource.getRepository(Report);
const sections = () => AppDataSource.getRepository(ReportSection);

const findConfig = (projectId: number) =>
  configs().findOne({ where: { project: { id: projectId } }, relations: ['sections'] });

export class ReportService {
  // ----- Configuration (enseignant) -----

  async getConfig(projectId: number, actor: Actor) {
    await findProjectForActor(projectId, actor);
    return serializeReportConfig(await findConfig(projectId), projectId);
  }

  /** Crée ou met à jour la configuration ; les sections absentes de la liste sont supprimées. */
  async saveConfig(projectId: number, teacherId: number, input: ReportConfigInput) {
    const project = await findOwnedProject(projectId, teacherId);
    const config = (await findConfig(projectId)) ?? configs().create({ project, sections: [], format: 'markdown', isEnabled: false });

    if (input.isEnabled !== undefined) config.isEnabled = input.isEnabled;
    if (input.format) config.format = input.format;
    if (input.deadline !== undefined) config.deadline = input.deadline ? new Date(input.deadline) : null;
    if (input.instructions !== undefined) config.instructions = input.instructions;

    if (input.sections) {
      const existing = new Map((config.sections ?? []).map(section => [section.id, section]));
      config.sections = input.sections.map((section, index) => {
        const target = (section.id && existing.get(Number(section.id))) || sectionConfigs().create();
        return Object.assign(target, {
          title: section.title.trim(),
          description: section.description ?? null,
          required: Boolean(section.required),
          wordLimit: section.wordLimit ?? null,
          orderIndex: index + 1,
        });
      });
    }
    return serializeReportConfig(await configs().save(config), projectId);
  }

  async updateSectionConfig(id: number, teacherId: number, input: Partial<SectionConfigInput>) {
    const section = await sectionConfigs().findOne({ where: { id }, relations: ['config', 'config.project', 'config.project.teacher'] });
    if (!section) throw notFound('Section introuvable');
    if (section.config.project.teacher?.id !== teacherId) throw forbidden('Cette section appartient à un autre enseignant');

    if (input.title !== undefined) section.title = input.title.trim();
    if (input.description !== undefined) section.description = input.description;
    if (input.required !== undefined) section.required = Boolean(input.required);
    if (input.wordLimit !== undefined) section.wordLimit = input.wordLimit;
    return serializeSectionConfig(await sectionConfigs().save(section));
  }

  // ----- Lecture -----

  async listProjectReports(projectId: number, teacherId: number) {
    await findOwnedProject(projectId, teacherId);
    const list = await reports().find({ where: { project: { id: projectId } }, relations: REPORT_RELATIONS, order: { id: 'ASC' } });
    return list.map(serializeReport);
  }

  async getGroupReport(groupId: number, projectId: number, actor: Actor) {
    const group = await findGroupForActor(groupId, actor);
    if (group.project.id !== projectId) throw notFound('Aucun rapport pour ce groupe');
    const report = await this.findReport(projectId, groupId);
    if (!report) throw notFound('Aucun rapport pour ce groupe');
    return serializeReport(report);
  }

  async exportPdf(reportId: number, actor: Actor): Promise<{ pdf: Buffer; filename: string }> {
    const report = await reports().findOne({ where: { id: reportId }, relations: REPORT_RELATIONS });
    if (!report) throw notFound('Rapport introuvable');
    await findGroupForActor(report.group.id, actor);

    const config = await findConfig(report.project.id);
    const pdf = await PDFGeneratorService.generateReport(report, config?.sections ?? [], report.sections);
    return { pdf, filename: `rapport-${report.id}.pdf` };
  }

  // ----- Rédaction (étudiant membre du groupe) -----

  async createReport(projectId: number, groupId: number, actor: Actor, title?: string) {
    const group = await findGroupForActor(groupId, actor);
    if (group.project.id !== projectId) throw badRequest('Ce groupe ne participe pas à ce projet');
    const report = (await this.findReport(projectId, groupId))
      ?? await reports().save(reports().create({ title: title ?? `Rapport - ${group.name}`, project: group.project, group, sections: [] }));
    return serializeReport(report);
  }

  async saveSectionContent(sectionConfigId: number, groupId: number, studentId: number, content: string) {
    const group = await findGroupForActor(groupId, { id: studentId, role: 'student' });
    const sectionConfig = await sectionConfigs().findOne({ where: { id: sectionConfigId }, relations: ['config', 'config.project'] });
    if (!sectionConfig || sectionConfig.config.project.id !== group.project.id) throw notFound('Section introuvable');
    if (!sectionConfig.config.isEnabled) throw forbidden("Le rapport n'est pas ouvert pour ce projet");

    const report = await this.getOrCreateReport(group);
    if (report.status === 'submitted') throw forbidden('Le rapport a déjà été soumis');

    const section = report.sections.find(item => item.sectionConfig.id === sectionConfigId)
      ?? sections().create({ report, sectionConfig });
    section.content = content;
    return serializeReportSection(await sections().save(section));
  }

  async submitReport(groupId: number, projectId: number, studentId: number) {
    const group = await findGroupForActor(groupId, { id: studentId, role: 'student' });
    if (group.project.id !== projectId) throw notFound('Aucun rapport à soumettre');
    const report = await this.findReport(projectId, groupId);
    if (!report) throw notFound('Aucun rapport à soumettre');
    if (report.status === 'submitted') throw conflict('Le rapport a déjà été soumis');

    const config = await findConfig(projectId);
    if (!config?.isEnabled) throw forbidden("Le rapport n'est pas ouvert pour ce projet");
    if (config.deadline && config.deadline < new Date()) throw forbidden('La date limite de remise du rapport est dépassée');

    const missing = config.sections.filter(section => section.required
      && !report.sections.some(item => item.sectionConfig.id === section.id && item.content.replace(/<[^>]*>/g, '').trim() !== ''));
    if (missing.length > 0) throw badRequest(`Sections obligatoires non remplies : ${missing.map(section => section.title).join(', ')}`);

    report.status = 'submitted';
    report.submittedAt = new Date();
    await reports().save({ id: report.id, status: report.status, submittedAt: report.submittedAt });
    return { success: true, status: report.status, submittedAt: report.submittedAt };
  }

  // ----- Utilitaires -----

  private findReport(projectId: number, groupId: number) {
    return reports().findOne({
      where: { project: { id: projectId }, group: { id: groupId } },
      relations: REPORT_RELATIONS,
    });
  }

  private async getOrCreateReport(group: { id: number; name: string; project: { id: number } }): Promise<Report> {
    const existing = await this.findReport(group.project.id, group.id);
    if (existing) return existing;
    const created = await reports().save(reports().create({
      title: `Rapport - ${group.name}`,
      project: { id: group.project.id },
      group: { id: group.id },
    }));
    return { ...created, sections: [] };
  }
}
