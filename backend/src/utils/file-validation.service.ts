import fs from 'fs';
import { DeliverableRule, RuleResult } from '../entities/Entities';
import { openArchive } from './archive';

export interface SubmissionInput {
  filePath?: string | null;
  gitUrl?: string | null;
}

type Outcome = Pick<RuleResult, 'passed' | 'message'>;

const MAX_REGEX_LENGTH = 200;
const NO_ARCHIVE = 'Archive illisible : seuls les fichiers ZIP peuvent être inspectés.';

function parseConfig(rule: DeliverableRule): Record<string, any> {
  try {
    const config = JSON.parse(rule.configuration);
    return config && typeof config === 'object' ? config : {};
  } catch {
    return {};
  }
}

const toList = (value: unknown): string[] =>
  (Array.isArray(value) ? value : typeof value === 'string' ? [value] : []).filter((v): v is string => typeof v === 'string' && v.trim() !== '');

function checkMaxSize(config: Record<string, any>, input: SubmissionInput): Outcome {
  if (input.gitUrl) return { passed: true, message: 'Lien Git : aucune limite de taille.' };
  if (!input.filePath) return { passed: false, message: 'Aucun fichier fourni.' };
  const maxMB = Number(config.maxSizeMB);
  if (!Number.isFinite(maxMB) || maxMB <= 0) return { passed: true, message: 'Limite de taille non configurée.' };
  const sizeMB = fs.statSync(input.filePath).size / (1024 * 1024);
  const message = `Taille du fichier : ${sizeMB.toFixed(1).replace('.', ',')} Mo (limite ${maxMB} Mo).`;
  return { passed: sizeMB <= maxMB, message };
}

function checkArchive(input: SubmissionInput, inspect: (archive: NonNullable<ReturnType<typeof openArchive>>) => Outcome): Outcome {
  if (input.gitUrl) return { passed: true, message: 'Contenu non vérifié pour un lien Git.' };
  if (!input.filePath) return { passed: false, message: 'Aucun fichier fourni.' };
  const archive = openArchive(input.filePath);
  return archive ? inspect(archive) : { passed: false, message: NO_ARCHIVE };
}

function checkFilePresence(config: Record<string, any>, input: SubmissionInput): Outcome {
  const required = [...toList(config.requiredFiles), ...toList(config.fileName)];
  return checkArchive(input, archive => {
    const missing = required.filter(name => !archive.files.some(file => file === name || file.endsWith(`/${name}`)));
    return missing.length === 0
      ? { passed: true, message: 'Tous les fichiers requis sont présents.' }
      : { passed: false, message: `Fichiers manquants : ${missing.join(', ')}.` };
  });
}

function checkFolderStructure(config: Record<string, any>, input: SubmissionInput): Outcome {
  const expected = toList(config.expectedStructure).map(folder => folder.replace(/\/$/, ''));
  return checkArchive(input, archive => {
    const missing = expected.filter(folder => ![...archive.folders].some(found => found === folder || found.endsWith(`/${folder}`)));
    return missing.length === 0
      ? { passed: true, message: 'Arborescence conforme.' }
      : { passed: false, message: `Dossiers manquants : ${missing.join(', ')}.` };
  });
}

function checkFileContent(config: Record<string, any>, input: SubmissionInput): Outcome {
  const fileName = typeof config.fileName === 'string' ? config.fileName : '';
  const pattern = typeof config.contentRegex === 'string' ? config.contentRegex : '';
  if (!fileName || !pattern || pattern.length > MAX_REGEX_LENGTH) return { passed: true, message: 'Règle de contenu non configurée.' };

  return checkArchive(input, archive => {
    const path = archive.files.find(file => file === fileName || file.endsWith(`/${fileName}`));
    if (!path) return { passed: false, message: `Fichier ${fileName} introuvable.` };
    const content = archive.readText(path);
    if (content === null) return { passed: false, message: `Fichier ${fileName} trop volumineux pour être analysé.` };
    try {
      return new RegExp(pattern).test(content)
        ? { passed: true, message: `Le contenu de ${fileName} est conforme.` }
        : { passed: false, message: `Le contenu de ${fileName} ne correspond pas au motif attendu.` };
    } catch {
      return { passed: true, message: 'Expression régulière invalide : règle ignorée.' };
    }
  });
}

/** Évalue les règles d'un livrable sur une soumission (fichier déjà enregistré sur disque ou lien Git). */
export function evaluateRules(rules: DeliverableRule[], input: SubmissionInput): { allPassed: boolean; rules: RuleResult[] } {
  const results = rules.map<RuleResult>(rule => {
    const config = parseConfig(rule);
    let outcome: Outcome;
    switch (rule.type) {
      case 'max_size': outcome = checkMaxSize(config, input); break;
      case 'file_presence': outcome = checkFilePresence(config, input); break;
      case 'folder_structure': outcome = checkFolderStructure(config, input); break;
      case 'file_content': outcome = checkFileContent(config, input); break;
    }
    return {
      type: rule.type,
      configuration: rule.configuration,
      passed: outcome.passed,
      message: !outcome.passed && rule.errorMessage ? rule.errorMessage : outcome.message,
    };
  });
  return { allPassed: results.every(result => result.passed), rules: results };
}
