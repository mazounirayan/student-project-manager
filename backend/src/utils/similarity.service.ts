import { createHash } from 'crypto';
import { openArchive } from './archive';

const TEXT_EXTENSIONS = /\.(js|jsx|ts|tsx|py|java|c|h|cpp|hpp|cs|go|rb|php|rs|kt|swift|html|css|scss|sql|sh|md|txt)$/i;
const MIN_LINE_LENGTH = 4;

/** Empreinte d'une archive : ensemble des lignes de code significatives, hachées. */
export type Fingerprint = Set<string>;

export interface SimilarityResult {
  finalScore: number;
  textScore: number;
  details: string;
}

export function fingerprintArchive(filePath: string): Fingerprint | null {
  const archive = openArchive(filePath);
  if (!archive) return null;

  const lines: Fingerprint = new Set();
  for (const file of archive.files.filter(name => TEXT_EXTENSIONS.test(name))) {
    for (const line of (archive.readText(file) ?? '').split(/\r?\n/)) {
      const trimmed = line.trim();
      if (trimmed.length >= MIN_LINE_LENGTH) lines.add(createHash('sha1').update(trimmed).digest('base64'));
    }
  }
  return lines;
}

/** Similarité de Jaccard entre deux empreintes, entre 0 et 1. */
export function compareFingerprints(a: Fingerprint, b: Fingerprint): SimilarityResult {
  let shared = 0;
  for (const line of a) if (b.has(line)) shared++;
  const union = a.size + b.size - shared;
  const score = union === 0 ? 0 : shared / union;
  return {
    finalScore: score,
    textScore: score,
    details: `${shared} lignes identiques sur ${union} lignes distinctes.`,
  };
}
