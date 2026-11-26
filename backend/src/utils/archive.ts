import AdmZip from 'adm-zip';

const MAX_ENTRIES = 10_000;
const MAX_TEXT_BYTES = 1024 * 1024;

export interface ArchiveIndex {
  /** Chemins des fichiers (sans les dossiers). */
  files: string[];
  /** Tous les dossiers, y compris ceux qui n'existent qu'à travers le chemin d'un fichier. */
  folders: Set<string>;
  /** Contenu texte d'un fichier, ou null s'il est absent ou trop volumineux. */
  readText(path: string): string | null;
}

const normalize = (entryName: string) => entryName.replace(/\\/g, '/').replace(/^\.?\//, '').replace(/\/$/, '');

/** Ouvre une archive ZIP ; renvoie null si le fichier n'est pas un ZIP lisible. */
export function openArchive(filePath: string): ArchiveIndex | null {
  let zip: AdmZip;
  try {
    zip = new AdmZip(filePath);
  } catch {
    return null;
  }
  const entries = zip.getEntries();
  if (entries.length > MAX_ENTRIES) return null;

  const byPath = new Map<string, AdmZip.IZipEntry>();
  const folders = new Set<string>();
  for (const entry of entries) {
    const name = normalize(entry.entryName);
    if (!name) continue;
    const segments = name.split('/');
    const folderDepth = entry.isDirectory ? segments.length : segments.length - 1;
    for (let depth = 1; depth <= folderDepth; depth++) folders.add(segments.slice(0, depth).join('/'));
    if (!entry.isDirectory) byPath.set(name, entry);
  }

  return {
    files: [...byPath.keys()],
    folders,
    readText(path) {
      const entry = byPath.get(normalize(path));
      if (!entry || entry.header.size > MAX_TEXT_BYTES) return null;
      return entry.getData().toString('utf8');
    },
  };
}
