import path from 'path';
import { AppDataSource } from '../database/data-source';
import {
  Deliverable, DeliverableRule, DeliverableSubmission, RuleType, SimilarityMatch,
} from '../entities/Entities';
import { evaluateRules } from '../utils/file-validation.service';
import { compareFingerprints, fingerprintArchive, Fingerprint } from '../utils/similarity.service';
import { removeUploadedFile } from '../middleware/upload.middleware';
import { UPLOAD_DIR } from '../config/uploads';
import { badRequest, forbidden, notFound } from '../utils/http-error';
import { parseId } from '../utils/route-id';
import { pick } from '../utils/pick';
import { serializeDeliverable, serializeRule, serializeSubmission } from '../serializers';
import { Actor, findGroupForActor, findOwnedProject, findProjectForActor } from './access.service';

export interface DeliverableInput {
  projectId?: number;
  name?: string;
  description?: string;
  type?: 'archive' | 'git_link';
  deadline?: Date | string;
  allowLateSubmission?: boolean;
  penaltyPerHour?: number;
}

export interface RuleInput {
  type?: RuleType;
  configuration?: unknown;
  errorMessage?: string | null;
}

export interface UploadedSubmission {
  groupId?: number;
  gitUrl?: string;
  file?: Express.Multer.File;
}

const EDITABLE_FIELDS = ['name', 'description', 'type', 'deadline', 'allowLateSubmission', 'penaltyPerHour'] as const;
const MAX_MATCHES_PER_SUBMISSION = 5;
const HOUR_MS = 3_600_000;

const deliverables = () => AppDataSource.getRepository(Deliverable);
const rules = () => AppDataSource.getRepository(DeliverableRule);
const submissions = () => AppDataSource.getRepository(DeliverableSubmission);

const serializeConfiguration = (configuration: unknown) =>
  typeof configuration === 'string' ? configuration : JSON.stringify(configuration ?? {});

function assertGitUrl(value: string | undefined): string {
  try {
    const url = new URL(value ?? '');
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.toString();
  } catch { /* message ci-dessous */ }
  throw badRequest('Le lien Git doit être une URL http(s) valide');
}

export class DeliverableService {
  // ----- Enseignant : livrables et règles -----

  async createDeliverable(teacherId: number, data: DeliverableInput) {
    const project = await findOwnedProject(Number(data.projectId), teacherId);
    const deliverable = await deliverables().save(deliverables().create({ ...pick(data, EDITABLE_FIELDS), project }));
    return serializeDeliverable({ ...deliverable, project, validationRules: [], submissions: [] });
  }

  async updateDeliverable(id: number, teacherId: number, data: DeliverableInput) {
    const deliverable = await this.findOwnedDeliverable(id, teacherId, ['validationRules']);
    Object.assign(deliverable, pick(data, EDITABLE_FIELDS));
    return serializeDeliverable(await deliverables().save(deliverable), []);
  }

  async deleteDeliverable(id: number, teacherId: number): Promise<void> {
    const deliverable = await this.findOwnedDeliverable(id, teacherId);
    const stored = await submissions().find({ where: { deliverable: { id } } });
    await deliverables().remove(deliverable);
    stored.forEach(submission => submission.filePath && removeUploadedFile({ path: submission.filePath }));
  }

  async addRule(deliverableId: number, teacherId: number, data: RuleInput) {
    const deliverable = await this.findOwnedDeliverable(deliverableId, teacherId);
    const rule = await rules().save(rules().create({
      type: data.type,
      configuration: serializeConfiguration(data.configuration),
      errorMessage: data.errorMessage,
      deliverable,
    }));
    return serializeRule(rule);
  }

  async updateRule(deliverableId: number, ruleId: number, teacherId: number, data: RuleInput) {
    const rule = await this.findOwnedRule(deliverableId, ruleId, teacherId);
    if (data.type) rule.type = data.type;
    if (data.configuration !== undefined) rule.configuration = serializeConfiguration(data.configuration);
    if (data.errorMessage !== undefined) rule.errorMessage = data.errorMessage;
    return serializeRule(await rules().save(rule));
  }

  async deleteRule(deliverableId: number, ruleId: number, teacherId: number): Promise<void> {
    await rules().remove(await this.findOwnedRule(deliverableId, ruleId, teacherId));
  }

  // ----- Lecture -----

  async getProjectDeliverables(projectId: number, actor: Actor) {
    await findProjectForActor(projectId, actor);
    const list = await deliverables().find({
      where: { project: { id: projectId } },
      relations: ['validationRules', 'submissions'],
      order: { deadline: 'ASC' },
    });
    return list.map(deliverable => ({ ...serializeDeliverable(deliverable, []), submissions: deliverable.submissions.length }));
  }

  async getSubmissions(deliverableId: number, teacherId: number) {
    await this.findOwnedDeliverable(deliverableId, teacherId);
    const list = await submissions().find({
      where: { deliverable: { id: deliverableId } },
      relations: ['group', 'deliverable'],
      order: { submittedAt: 'ASC' },
    });
    return list.map(submission => serializeSubmission(submission, { teacher: true, peers: list }));
  }

  async getGroupSubmission(deliverableId: number, groupId: number, teacherId: number) {
    await this.findOwnedDeliverable(deliverableId, teacherId);
    const submission = await submissions().findOne({
      where: { deliverable: { id: deliverableId }, group: { id: groupId } },
      relations: ['group', 'deliverable'],
    });
    if (!submission) throw notFound('Aucun rendu pour ce groupe');
    const peers = await submissions().find({ where: { deliverable: { id: deliverableId } }, relations: ['group'] });
    return serializeSubmission(submission, { teacher: true, peers });
  }

  /** Fichier d'une soumission, réservé à l'enseignant du projet et aux membres du groupe. */
  async getSubmissionFile(submissionId: number, actor: Actor): Promise<{ path: string; name: string }> {
    const submission = await submissions().findOne({ where: { id: submissionId }, relations: ['group'] });
    if (!submission?.filePath) throw notFound('Fichier du rendu introuvable');
    await findGroupForActor(submission.group.id, actor);

    const file = path.resolve(submission.filePath);
    if (path.relative(UPLOAD_DIR, file).startsWith('..')) throw forbidden('Emplacement de fichier invalide');
    return { path: file, name: submission.fileName ?? path.basename(file) };
  }

  // ----- Étudiant : validation et soumission -----

  async validateBeforeSubmit(deliverableId: number, student: Actor, input: UploadedSubmission) {
    const deliverable = await this.findDeliverableForStudent(deliverableId, student.id);
    const source = this.readSource(deliverable, input);
    return evaluateRules(deliverable.validationRules, source);
  }

  async submit(deliverableId: number, student: Actor, input: UploadedSubmission) {
    const deliverable = await this.findDeliverableForStudent(deliverableId, student.id);
    const group = await findGroupForActor(parseId(input.groupId), student);
    if (group.project.id !== deliverable.project.id) throw badRequest('Ce groupe ne participe pas à ce projet');

    const source = this.readSource(deliverable, input);
    const now = new Date();
    const lateMs = now.getTime() - deliverable.deadline.getTime();
    const isLate = lateMs > 0;
    if (isLate && !deliverable.allowLateSubmission) throw forbidden('La date limite est dépassée et les rendus tardifs ne sont pas autorisés');

    const previous = await submissions().findOne({ where: { deliverable: { id: deliverableId }, group: { id: group.id } } });
    const saved = await submissions().save(Object.assign(previous ?? submissions().create(), {
      deliverable,
      group,
      filePath: input.file?.path ?? null,
      fileName: input.file?.originalname ?? null,
      fileSize: input.file?.size ?? null,
      gitUrl: source.gitUrl ?? null,
      submittedAt: now,
      isLate,
      penalty: isLate ? Math.round(Math.ceil(lateMs / HOUR_MS) * deliverable.penaltyPerHour * 100) / 100 : 0,
      validationResults: evaluateRules(deliverable.validationRules, source).rules,
      similarityScore: null,
      similarityMatches: null,
    }));

    if (previous?.filePath && previous.filePath !== saved.filePath) removeUploadedFile({ path: previous.filePath });
    return serializeSubmission(saved);
  }

  // ----- Similarité -----

  async analyzeSimilarity(deliverableId: number, teacherId: number) {
    await this.findOwnedDeliverable(deliverableId, teacherId);
    const list = await submissions().find({ where: { deliverable: { id: deliverableId } }, relations: ['group'] });

    const prints = new Map<number, Fingerprint>();
    for (const submission of list) {
      const print = submission.filePath ? fingerprintArchive(submission.filePath) : null;
      if (print) prints.set(submission.id, print);
    }

    const matches = new Map<number, SimilarityMatch[]>(list.map(submission => [submission.id, []]));
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const [a, b] = [list[i], list[j]];
        const result = prints.has(a.id) && prints.has(b.id)
          ? compareFingerprints(prints.get(a.id)!, prints.get(b.id)!)
          : a.gitUrl && a.gitUrl === b.gitUrl
            ? { finalScore: 1, textScore: 1, details: 'Même dépôt Git.' }
            : null;
        if (!result) continue;
        matches.get(a.id)!.push({ submissionId: b.id, ...result });
        matches.get(b.id)!.push({ submissionId: a.id, ...result });
      }
    }

    // Un rendu qu'on ne peut pas lire (archive illisible, lien Git) n'a pas de score : « 0 % » dirait à tort qu'il a été vérifié.
    let analyzed = 0;
    for (const submission of list) {
      const readable = prints.has(submission.id) || Boolean(submission.gitUrl);
      const top = matches.get(submission.id)!.sort((x, y) => y.finalScore - x.finalScore).slice(0, MAX_MATCHES_PER_SUBMISSION);
      submission.similarityMatches = readable ? top : null;
      submission.similarityScore = readable ? top[0]?.finalScore ?? 0 : null;
      if (readable) analyzed++;
    }
    await submissions().save(list);

    return {
      message: `Analyse terminée : ${analyzed} rendu${analyzed > 1 ? 's' : ''} comparé${analyzed > 1 ? 's' : ''}.`,
      analyzed,
      skipped: list.length - analyzed,
    };
  }

  async getSimilarity(submissionId: number, teacherId: number) {
    const submission = await submissions().findOne({ where: { id: submissionId }, relations: ['deliverable', 'group'] });
    if (!submission) throw notFound('Rendu introuvable');
    await this.findOwnedDeliverable(submission.deliverable.id, teacherId);

    const others = await submissions().find({ where: { deliverable: { id: submission.deliverable.id } } });
    const label = (s: DeliverableSubmission) => s.fileName ?? s.gitUrl ?? '';
    const byId = new Map(others.map(other => [other.id, other]));

    return {
      submission: { id: submission.id, similarityScore: submission.similarityScore ?? 0 },
      topMatches: (submission.similarityMatches ?? []).map(match => ({
        submissionId1: submission.id,
        submissionId2: match.submissionId,
        finalScore: match.finalScore,
        textScore: match.textScore,
        filePath1: label(submission),
        filePath2: byId.has(match.submissionId) ? label(byId.get(match.submissionId)!) : '',
        details: match.details,
      })),
    };
  }

  // ----- Utilitaires -----

  private readSource(deliverable: Deliverable, input: UploadedSubmission) {
    if (deliverable.type === 'archive') {
      if (!input.file) throw badRequest('Un fichier est requis pour ce livrable');
      return { filePath: input.file.path };
    }
    return { gitUrl: assertGitUrl(input.gitUrl) };
  }

  private async findOwnedDeliverable(id: number, teacherId: number, relations: string[] = []): Promise<Deliverable> {
    const deliverable = await deliverables().findOne({ where: { id }, relations: ['project', 'project.teacher', ...relations] });
    if (!deliverable) throw notFound('Livrable introuvable');
    if (deliverable.project.teacher?.id !== teacherId) throw forbidden('Ce livrable appartient à un autre enseignant');
    return deliverable;
  }

  private async findOwnedRule(deliverableId: number, ruleId: number, teacherId: number): Promise<DeliverableRule> {
    await this.findOwnedDeliverable(deliverableId, teacherId);
    const rule = await rules().findOne({ where: { id: ruleId, deliverable: { id: deliverableId } } });
    if (!rule) throw notFound('Règle introuvable');
    return rule;
  }

  private async findDeliverableForStudent(id: number, studentId: number): Promise<Deliverable> {
    const deliverable = await deliverables().findOne({
      where: { id, project: { status: 'visible', promotion: { students: { id: studentId } } } },
      relations: ['project', 'validationRules'],
    });
    if (!deliverable) throw notFound('Livrable introuvable');
    return deliverable;
  }
}
