/** Aides communes aux listes de personnes (étudiants d’une promotion, comptes utilisateurs). */

export interface Person {
  firstName: string
  lastName: string
  email: string
}

export const fullName = (person: Pick<Person, "firstName" | "lastName">) => `${person.firstName} ${person.lastName}`.trim()

export function initials(person: Pick<Person, "firstName" | "lastName" | "email">) {
  const letters = `${person.firstName?.[0] ?? ""}${person.lastName?.[0] ?? ""}`
  return (letters || person.email?.[0] || "?").toUpperCase()
}

/** Minuscules sans accents, pour comparer et chercher sans se soucier de la saisie. */
export function normalizeText(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()
}

/** Chaque mot cherché doit apparaître dans le nom, le prénom ou l’adresse (« moret alex » trouve Alex Moret). */
export function matchesQuery(person: Person, query: string) {
  const words = normalizeText(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const haystack = normalizeText(`${person.firstName} ${person.lastName} ${person.email}`)
  return words.every((word) => haystack.includes(word))
}

const collator = new Intl.Collator("fr", { sensitivity: "base", numeric: true })

export const compareText = (a: string, b: string) => collator.compare(a, b)

/** Ordre alphabétique : nom de famille, puis prénom. */
export function compareByName(a: Person, b: Person) {
  return compareText(a.lastName, b.lastName) || compareText(a.firstName, b.firstName)
}
