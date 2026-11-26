/**
 * Lecture et contrôle d’une liste d’étudiants (fichier CSV ou JSON, texte collé depuis un tableur).
 * Les règles reprennent celles de l’API (adresse valide, pas de doublon) pour annoncer ligne par ligne,
 * avant l’import, ce qui sera ajouté et ce qui sera ignoré.
 */
import { normalizeText } from "@/lib/people"

export const MAX_STUDENTS_PER_IMPORT = 500

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const COLUMN_NAMES = {
  email: ["email", "e-mail", "mail", "courriel"],
  firstName: ["prenom", "firstname", "first_name"],
  lastName: ["nom", "lastname", "last_name"],
} as const

type Column = keyof typeof COLUMN_NAMES

export interface StudentRow {
  /** Repère lisible dans la source : « Ligne 4 » (CSV, texte) ou « Élément 4 » (JSON). */
  where: string
  lastName: string
  firstName: string
  email: string
}

export interface ParsedList {
  rows: StudentRow[]
  /** Raison pour laquelle la liste est inutilisable dans son ensemble (colonne absente, JSON mal formé…). */
  error?: string
}

export type RowState = "ready" | "invalid" | "duplicate" | "enrolled"

export interface CheckedRow extends StudentRow {
  state: RowState
  /** Explication affichée quand la ligne sera ignorée. */
  message?: string
}

function columnOf(name: string): Column | null {
  const key = normalizeText(name)
  return (Object.keys(COLUMN_NAMES) as Column[]).find((column) => (COLUMN_NAMES[column] as readonly string[]).includes(key)) ?? null
}

function detectSeparator(line: string) {
  const counts = ["\t", ";", ","].map((separator) => [separator, line.split(separator).length] as const)
  return counts.reduce((best, current) => (current[1] > best[1] ? current : best))[0]
}

/** Découpe une ligne en respectant les champs entre guillemets. */
function splitLine(line: string, separator: string) {
  const cells: string[] = []
  let cell = ""
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        cell += '"'
        i++
      } else if (char === '"') quoted = false
      else cell += char
    } else if (char === '"') quoted = true
    else if (char === separator) {
      cells.push(cell.trim())
      cell = ""
    } else cell += char
  }
  cells.push(cell.trim())
  return cells
}

export function parseCsv(text: string): ParsedList {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((content, index) => ({ content, number: index + 1 }))
    .filter((line) => line.content.trim())
  if (lines.length === 0) return { rows: [], error: "Le fichier est vide." }

  const separator = detectSeparator(lines[0].content)
  const first = splitLine(lines[0].content, separator)
  const columns = first.map(columnOf)
  const hasHeader = columns.some(Boolean)

  if (hasHeader && !columns.includes("email")) {
    return { rows: [], error: "Colonne « email » introuvable. La première ligne doit être : nom,prenom,email." }
  }

  const body = hasHeader ? lines.slice(1) : lines
  const rows = body.map(({ content, number }): StudentRow => {
    const cells = splitLine(content, separator)
    const where = `Ligne ${number}`
    if (hasHeader) {
      const pick = (column: Column) => cells[columns.indexOf(column)] ?? ""
      return { where, lastName: pick("lastName"), firstName: pick("firstName"), email: pick("email") }
    }
    // Sans en-tête : l’adresse est la cellule qui contient « @ », puis le nom et le prénom dans l’ordre.
    const emailIndex = cells.findIndex((cell) => cell.includes("@"))
    const others = cells.filter((_, index) => index !== emailIndex)
    return { where, lastName: others[0] ?? "", firstName: others[1] ?? "", email: emailIndex === -1 ? "" : cells[emailIndex] }
  })
  return { rows }
}

export function parseJson(text: string): ParsedList {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { rows: [], error: "Le JSON est mal formé : vérifiez les virgules, les guillemets et les crochets." }
  }
  if (!Array.isArray(data)) return { rows: [], error: "Le JSON doit être un tableau d’étudiants, entre crochets [ ]." }

  const rows = data.map((item, index): StudentRow => {
    const entries = item && typeof item === "object" ? Object.entries(item as Record<string, unknown>) : []
    const pick = (column: Column) => {
      const entry = entries.find(([key]) => columnOf(key) === column)
      return typeof entry?.[1] === "string" ? entry[1].trim() : ""
    }
    return { where: `Élément ${index + 1}`, lastName: pick("lastName"), firstName: pick("firstName"), email: pick("email") }
  })
  return { rows }
}

/** Texte collé : du JSON s’il commence par un crochet, sinon des lignes de tableur. */
export function parseStudentText(text: string): ParsedList {
  return text.trim().startsWith("[") ? parseJson(text) : parseCsv(text)
}

const isBlank = (row: StudentRow) => !row.lastName && !row.firstName && !row.email

/**
 * Classe chaque ligne : prête, adresse manquante ou invalide, doublon dans la liste,
 * ou étudiant déjà inscrit dans la promotion. Les lignes entièrement vides sont ignorées sans bruit.
 */
export function checkRows(rows: StudentRow[], enrolledEmails: Set<string>): CheckedRow[] {
  const seen = new Map<string, string>()
  return rows
    .filter((row) => !isBlank(row))
    .map((row): CheckedRow => {
      const email = row.email.trim().toLowerCase()
      if (!email) return { ...row, state: "invalid", message: "Adresse e-mail manquante." }
      if (!EMAIL_PATTERN.test(email)) return { ...row, state: "invalid", message: `Adresse e-mail invalide : « ${row.email} ».` }
      const firstSeen = seen.get(email)
      if (firstSeen) return { ...row, email, state: "duplicate", message: `Même adresse que ${firstSeen.toLowerCase()}.` }
      seen.set(email, row.where)
      if (enrolledEmails.has(email)) return { ...row, email, state: "enrolled", message: "Déjà dans la promotion." }
      return { ...row, email, state: "ready" }
    })
}

export function countStates(rows: CheckedRow[]): Record<RowState, number> {
  const counts: Record<RowState, number> = { ready: 0, invalid: 0, duplicate: 0, enrolled: 0 }
  for (const row of rows) counts[row.state]++
  return counts
}

const TEMPLATE = ["nom;prenom;email", "Dupont;Jean;jean.dupont@example.org", "Martin;Claire;claire.martin@example.org"].join("\r\n")

/** Modèle CSV à ouvrir dans un tableur (séparateur point-virgule, accents corrects dans Excel). */
export function downloadStudentTemplate() {
  const url = URL.createObjectURL(new Blob([`\uFEFF${TEMPLATE}\r\n`], { type: "text/csv;charset=utf-8" }))
  const link = document.createElement("a")
  link.href = url
  link.download = "modele-etudiants.csv"
  link.click()
  URL.revokeObjectURL(url)
}
