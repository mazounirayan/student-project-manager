/**
 * Routeur de démonstration : répond aux appels /api/... à partir de la base
 * fictive stockée dans le localStorage. Aucun réseau : tout est local.
 */
import { DEMO_ACCOUNTS } from "./mode"
import { loadDemoDb, nextId, persist } from "./store"
import { serializeSession, serializeGrid, serializeGroup, serializeDefense, serializeProjectDetail, serializeProjectSummary, serializeReport, serializeSubmission, serializeUser } from "./serialize"
import { parseCsv, parseJson } from "../student-import"
import type { DemoCriterion, DemoDb, DemoDeliverable, DemoGroup, DemoProject, DemoPromotion, DemoReport, DemoSession, DemoUser } from "./types"

export class DemoApiError {
  status: number
  message: string

  constructor(status: number, message: string) {
    this.status = status
    this.message = message
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  })
}

function ok(): Response {
  return new Response(null, { status: 204 })
}

function fail(status: number, message: string): Response {
  return json({ error: message }, status)
}

function userFromToken(db: DemoDb, token: string | null): DemoUser | null {
  if (!token) return null
  const match = /^demo-token-(\d+)$/.exec(token)
  if (!match) return null
  return db.users.find((u) => u.id === Number(match[1])) ?? null
}

function readToken(init: RequestInit | undefined, headers: Headers): string | null {
  const auth = headers.get("authorization") ?? (init?.headers as Record<string, string> | undefined)?.Authorization
  return auth ? auth.replace(/^Bearer\s+/i, "") : null
}

async function readBody(init: RequestInit | undefined): Promise<Record<string, any>> {
  const body = init?.body
  if (!body) return {}
  if (body instanceof FormData) return body as unknown as Record<string, any>
  try {
    return JSON.parse(String(body))
  } catch {
    return {}
  }
}

function requireUser(db: DemoDb, init: RequestInit | undefined, headers: Headers): DemoUser {
  const user = userFromToken(db, readToken(init, headers))
  if (!user) throw new DemoApiError(401, "Session expirée, reconnectez-vous.")
  if (!user.isActive) throw new DemoApiError(401, "Compte introuvable ou désactivé")
  return user
}

function requireTeacher(db: DemoDb, init: RequestInit | undefined, headers: Headers): DemoUser {
  const user = requireUser(db, init, headers)
  if (user.role !== "teacher") throw new DemoApiError(403, "Accès réservé aux enseignants.")
  return user
}

function requireStudent(db: DemoDb, init: RequestInit | undefined, headers: Headers): DemoUser {
  const user = requireUser(db, init, headers)
  if (user.role !== "student") throw new DemoApiError(403, "Accès réservé aux étudiants.")
  return user
}

function canAccessProject(db: DemoDb, user: DemoUser, projectId: number): boolean {
  const project = db.projects.find((p) => p.id === projectId)
  if (!project) return false
  if (user.role === "teacher") return project.teacherId === user.id
  const promotion = db.promotions.find((p) => p.id === project.promotionId)
  return project.status === "visible" && Boolean(promotion?.studentIds.includes(user.id))
}

/** Texte brut d’une section (balises de l’éditeur retirées). */
function htmlText(content: string): string {
  return content.replace(/<[^>]*>/g, "").trim()
}

/** Le rapport d’un groupe est créé à la première modification ou soumission. */
function findOrCreateReport(db: DemoDb, group: DemoGroup): DemoReport {
  let report = db.reports.find((r) => r.groupId === group.id && r.projectId === group.projectId)
  if (!report) {
    const project = db.projects.find((p) => p.id === group.projectId)
    report = {
      id: nextId(db),
      projectId: group.projectId,
      groupId: group.id,
      title: `Rapport – ${project?.name ?? group.name}`,
      status: "draft",
      sections: [],
    }
    db.reports.push(report)
  }
  return report
}

/** Message de refus tant que les étudiants ne peuvent pas rejoindre ou quitter un groupe eux-mêmes, sinon null. */
function freeFormationClosed(project: DemoProject, verb: "rejoindre" | "quitter" = "rejoindre"): string | null {
  if (project.groupFormationRule !== "free") {
    return verb === "quitter"
      ? "Les groupes de ce projet sont constitués par votre enseignant : contactez-le pour en changer"
      : "Ce projet n’autorise pas l’inscription libre dans les groupes"
  }
  if (project.groupFormationDeadline && new Date(project.groupFormationDeadline) < new Date()) {
    return "La date limite de formation des groupes est dépassée"
  }
  return null
}

/** « Groupe N » avec N supérieur à tous les numéros déjà utilisés dans le projet. */
function nextGroupName(db: DemoDb, projectId: number): string {
  const groups = db.groups.filter((g) => g.projectId === projectId)
  const used = groups.map((g) => Number(/^Groupe (\d+)$/.exec(g.name)?.[1] ?? 0))
  return `Groupe ${Math.max(0, groups.length, ...used) + 1}`
}

function assertOwnsProject(db: DemoDb, teacher: DemoUser, projectId: number): void {
  const project = db.projects.find((p) => p.id === projectId)
  if (!project) throw new DemoApiError(404, "Projet introuvable.")
  if (project.teacherId !== teacher.id) throw new DemoApiError(403, "Ce projet appartient à un autre enseignant.")
}

function assertOwnsPromotion(db: DemoDb, teacher: DemoUser, promotionId: number): void {
  const promotion = db.promotions.find((p) => p.id === promotionId)
  if (!promotion) throw new DemoApiError(404, "Promotion introuvable.")
  if (promotion.teacherId !== teacher.id) throw new DemoApiError(403, "Cette promotion appartient à un autre enseignant.")
}

/** Projet d’un livrable, d’une grille ou d’un critère, pour vérifier le propriétaire. */
function assertOwnsDeliverable(db: DemoDb, teacher: DemoUser, deliverableId: number): void {
  const d = db.deliverables.find((x) => x.id === deliverableId)
  if (!d) throw new DemoApiError(404, "Livrable introuvable.")
  assertOwnsProject(db, teacher, d.projectId)
}

function idsFromForm(form: FormData, key: string): number[] {
  const raw = form.get(key)
  if (typeof raw !== "string") return []
  return raw.split(",").map((v) => Number(v.trim())).filter((v) => Number.isFinite(v))
}

function formDataFile(form: FormData): File | null {
  const file = form.get("file")
  return file instanceof File ? file : null
}

function formDataGitUrl(form: FormData): string | null {
  const url = form.get("gitUrl")
  return typeof url === "string" && url.trim() ? url.trim() : null
}

const NOT_AN_ARCHIVE = "Archive illisible : seuls les fichiers ZIP peuvent être inspectés."

function maxSizeResult(file: File | null, gitUrl: string | null, configuration: string) {
  let maxMB = 50
  try {
    maxMB = Number(JSON.parse(configuration).maxSizeMB) || 50
  } catch {
    // configuration illisible : limite par défaut
  }
  if (gitUrl) return { passed: true, message: "Lien Git : aucune limite de taille." }
  if (!file) return { passed: false, message: "Aucun fichier fourni." }
  const sizeMB = file.size / (1024 * 1024)
  return { passed: sizeMB <= maxMB, message: `Taille du fichier : ${sizeMB.toFixed(1).replace(".", ",")} Mo (limite ${maxMB} Mo).` }
}

/** Contenu d’archive : la démo ne lit pas les ZIP, elle le dit et ne vérifie que ce qu’elle peut (présence d’un ZIP). */
function archiveResult(file: File | null, gitUrl: string | null) {
  if (gitUrl) return { passed: true, message: "Contenu non vérifié pour un lien Git." }
  if (!file) return { passed: false, message: "Aucun fichier fourni." }
  if (!/\.zip$/i.test(file.name)) return { passed: false, message: NOT_AN_ARCHIVE }
  return { passed: true, message: "Archive ZIP reçue. Son contenu n’est pas inspecté dans la démo." }
}

/** Évalue les règles d’un livrable sur un fichier ou un lien fourni, avec le même format de réponse que l’API. */
function evaluateRules(db: DemoDb, deliverableId: number, file: File | null, gitUrl: string | null) {
  const results = db.rules
    .filter((r) => r.deliverableId === deliverableId)
    .map((rule) => {
      const outcome = rule.type === "max_size" ? maxSizeResult(file, gitUrl, rule.configuration) : archiveResult(file, gitUrl)
      return {
        type: rule.type,
        configuration: rule.configuration,
        passed: outcome.passed,
        message: !outcome.passed && rule.errorMessage ? rule.errorMessage : outcome.message,
      }
    })
  return { allPassed: results.every((r) => r.passed), rules: results }
}

function weightedTotal(db: DemoDb, gridId: number, entries: Array<{ criterionId: number; score: number }>): number {
  const grid = db.grids.find((g) => g.id === gridId)
  if (!grid) return 0
  let weighted = 0
  let totalWeight = 0
  for (const criterion of grid.criteria) {
    const entry = entries.find((e) => e.criterionId === criterion.id)
    if (entry) {
      weighted += (Math.min(entry.score, criterion.maxScore) / criterion.maxScore) * 20 * criterion.weight
      totalWeight += criterion.weight
    }
  }
  return totalWeight > 0 ? Math.round((weighted / totalWeight) * 100) / 100 : 0
}

function upsertSession(db: DemoDb, teacher: DemoUser, payload: any): DemoSession {
  const grid = db.grids.find((g) => g.id === payload.gridId)
  if (!grid) throw new DemoApiError(404, "Grille introuvable.")
  const groupId = Number(payload.groupId)
  const existing = payload.id
    ? db.sessions.find((s) => s.id === Number(payload.id))
    : db.sessions.find((s) => s.gridId === grid.id && s.groupId === groupId)

  const entries = (payload.entries ?? []).map((e: any) => ({
    id: Number(e.id) > 0 ? Number(e.id) : nextId(db),
    criterionId: Number(e.criterionId),
    score: Number(e.score) || 0,
    comment: e.comment ?? "",
  }))
  for (const entry of entries) {
    const criterion = grid.criteria.find((c) => c.id === entry.criterionId)
    if (!criterion) throw new DemoApiError(400, "Un critère n’appartient pas à cette grille")
    if (entry.score > criterion.maxScore) throw new DemoApiError(400, `La note du critère « ${criterion.name} » dépasse ${criterion.maxScore}`)
  }
  const status = payload.status === "validated" ? "validated" : payload.status === "submitted" ? "submitted" : "draft"
  if (status === "validated") assertReadyToValidate(grid.criteria, entries)
  const now = new Date().toISOString()
  const totalScore = weightedTotal(db, grid.id, entries)

  if (existing) {
    existing.entries = entries
    existing.globalComment = payload.globalComment ?? existing.globalComment
    existing.totalScore = totalScore
    existing.status = status
    existing.gradedBy = teacher.id
    existing.gradedAt = now
    // Rouvrir une note (la repasser en brouillon) la retire aussi de la vue des étudiants.
    existing.validatedAt = status === "validated" ? existing.validatedAt ?? now : undefined
    existing.publishedAt = status === "validated" ? existing.publishedAt : undefined
    persist()
    return existing
  }

  const session: DemoSession = {
    id: nextId(db),
    gridId: grid.id,
    groupId,
    entries,
    globalComment: payload.globalComment ?? "",
    totalScore,
    status,
    gradedBy: teacher.id,
    gradedAt: now,
    submittedAt: status === "draft" ? undefined : now,
    validatedAt: status === "validated" ? now : undefined,
  }
  db.sessions.push(session)
  persist()
  return session
}

/** Une note ne peut être validée que complète : chaque critère noté, et un commentaire là où il est attendu. */
function assertReadyToValidate(criteria: DemoCriterion[], entries: Array<{ criterionId: number; comment: string }>) {
  const missing = criteria.filter((c) => !entries.some((e) => e.criterionId === c.id))
  if (missing.length > 0) {
    throw new DemoApiError(400, `Il reste ${missing.length} critère${missing.length > 1 ? "s" : ""} sans note : ${missing.map((c) => `« ${c.name} »`).join(", ")}`)
  }
  const uncommented = criteria.filter((c) => c.hasComments && !entries.find((e) => e.criterionId === c.id)?.comment.trim())
  if (uncommented.length > 0) throw new DemoApiError(400, `Un commentaire est attendu pour : ${uncommented.map((c) => `« ${c.name} »`).join(", ")}`)
}

/** Modifier ou retirer un critère change le total des notes déjà saisies : on les recalcule. */
function recomputeTotals(db: DemoDb, gridId: number) {
  for (const session of db.sessions.filter((s) => s.gridId === gridId)) session.totalScore = weightedTotal(db, gridId, session.entries)
}

const isPublished = (session: DemoSession) => session.status === "validated" && Boolean(session.publishedAt)

/** Note moyenne pondérée par le poids de chaque grille ; à poids tous nuls, chaque grille compte autant. */
function weightedFinal(items: Array<{ score: number; weight: number }>): number | null {
  if (items.length === 0) return null
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0)
  const value = totalWeight > 0 ? items.reduce((sum, item) => sum + item.score * item.weight, 0) / totalWeight : items.reduce((sum, item) => sum + item.score, 0) / items.length
  return Math.round(value * 100) / 100
}

function buildSummary(db: DemoDb, projectId: number) {
  const grids = db.grids.filter((g) => g.projectId === projectId)
  const groups = db.groups.filter((g) => g.projectId === projectId)
  const project = db.projects.find((p) => p.id === projectId)

  const groupRows = groups.map((group) => {
    const sessions = grids.flatMap((grid) => {
      const session = db.sessions.find((s) => s.gridId === grid.id && s.groupId === group.id)
      return session ? [{ grid, session }] : []
    })
    return {
      id: group.id,
      name: group.name,
      members: group.memberIds.map((id) => serializeUser(db, id)),
      grades: sessions.map(({ grid, session }) => ({
        id: session.id,
        gridId: grid.id,
        gridName: grid.name,
        totalScore: session.totalScore,
        status: session.status,
        isValidated: session.status === "validated",
        isPublished: isPublished(session),
      })),
      finalGrade: weightedFinal(
        sessions.filter(({ session }) => session.status === "validated").map(({ grid, session }) => ({ score: session.totalScore, weight: grid.weight })),
      ),
    }
  })

  return {
    project: { id: projectId, name: project?.name ?? "" },
    gradingGrids: grids.map((g) => ({ id: g.id, name: g.name, type: g.type, weight: g.weight, deliverableId: g.deliverableId ?? null })),
    groups: groupRows,
  }
}

function myGrades(db: DemoDb, user: DemoUser) {
  const myGroups = db.groups.filter((g) => g.memberIds.includes(user.id))
  const rows: Array<Record<string, unknown>> = []
  for (const session of db.sessions) {
    if (!isPublished(session)) continue
    if (!myGroups.some((g) => g.id === session.groupId)) continue
    const grid = db.grids.find((g) => g.id === session.gridId)
    const group = db.groups.find((g) => g.id === session.groupId)
    const project = db.projects.find((p) => p.id === grid?.projectId)
    if (!grid || !project) continue
    rows.push({
      id: session.id,
      projectId: project.id,
      projectName: project.name,
      groupId: group?.id,
      groupName: group?.name,
      gridId: grid.id,
      type: grid.type,
      title: grid.name,
      grade: session.totalScore,
      maxGrade: 20,
      feedback: session.globalComment || null,
      gradedAt: session.publishedAt,
      criteria: session.entries.map((e) => {
        const criterion = grid.criteria.find((c) => c.id === e.criterionId)
        return {
          name: criterion?.name ?? "",
          score: e.score,
          maxScore: criterion?.maxScore ?? 20,
          comments: e.comment || null,
          weight: criterion?.weight ?? 1,
        }
      }),
    })
  }
  return rows.sort((a, b) => String(b.gradedAt).localeCompare(String(a.gradedAt)))
}

/** Avancement vu par l’étudiant : évaluations publiées ou pas encore, sans rien révéler des notes non publiées. */
function myOverview(db: DemoDb, user: DemoUser) {
  return db.groups
    .filter((group) => group.memberIds.includes(user.id))
    .flatMap((group) => {
      const project = db.projects.find((p) => p.id === group.projectId)
      const grids = db.grids.filter((g) => g.projectId === group.projectId)
      if (!project || project.status !== "visible" || grids.length === 0) return []
      const totalWeight = grids.reduce((sum, grid) => sum + grid.weight, 0)
      const evaluations = grids.map((grid) => {
        const session = db.sessions.find((s) => s.gridId === grid.id && s.groupId === group.id && isPublished(s))
        return {
          gridId: grid.id,
          title: grid.name,
          type: grid.type,
          share: totalWeight > 0 ? grid.weight / totalWeight : 1 / grids.length,
          published: Boolean(session),
          grade: session ? session.totalScore : null,
        }
      })
      const published = evaluations.flatMap((item) => (item.grade === null ? [] : [{ score: item.grade, weight: item.share }]))
      return [
        {
          projectId: project.id,
          projectName: project.name,
          groupId: group.id,
          groupName: group.name,
          finalGrade: weightedFinal(published),
          complete: published.length === evaluations.length,
          evaluations,
        },
      ]
    })
}

const isValidYear = (year: unknown) => Number.isInteger(Number(year)) && Number(year) >= 2000 && Number(year) <= 2100

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_STUDENTS_PER_REQUEST = 500

interface StudentEntry {
  email?: string
  firstName?: string
  lastName?: string
}

/** Même bilan que l’API : comptes créés, comptes existants rattachés, lignes ignorées avec leur raison. */
function enrollStudents(db: DemoDb, promotion: DemoPromotion, entries: StudentEntry[]) {
  if (entries.length > MAX_STUDENTS_PER_REQUEST) throw new DemoApiError(400, `${MAX_STUDENTS_PER_REQUEST} étudiants maximum par requête`)
  const summary = { totalProcessed: 0, newStudents: 0, existingStudents: 0, errors: [] as string[] }
  const seen = new Set<string>()

  entries.forEach((entry, index) => {
    summary.totalProcessed++
    const email = entry.email?.trim().toLowerCase()
    if (!email || !EMAIL_PATTERN.test(email)) {
      summary.errors.push(`Ligne ${index + 1} : adresse email manquante ou invalide`)
      return
    }
    if (seen.has(email)) {
      summary.errors.push(`Ligne ${index + 1} : adresse en double (${email})`)
      return
    }
    seen.add(email)

    let student = db.users.find((u) => u.email.toLowerCase() === email)
    if (student && student.role !== "student") {
      summary.errors.push(`Ligne ${index + 1} : ${email} est un compte enseignant`)
      return
    }
    if (student) {
      summary.existingStudents++
    } else {
      const guess = email.split("@")[0].split(".")[0]
      student = {
        id: nextId(db),
        email,
        firstName: entry.firstName?.trim() || guess.charAt(0).toUpperCase() + guess.slice(1).toLowerCase(),
        lastName: entry.lastName?.trim() || "",
        role: "student",
        isActive: true,
        createdAt: new Date().toISOString(),
      }
      db.users.push(student)
      summary.newStudents++
    }
    if (!promotion.studentIds.includes(student.id)) promotion.studentIds.push(student.id)
  })
  persist()

  return { promotion: { ...promotion, students: promotion.studentIds.map((id) => serializeUser(db, id)) }, summary }
}

async function importStudentFile(db: DemoDb, promotion: DemoPromotion, file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase()
  if (extension !== "csv" && extension !== "json") {
    throw new DemoApiError(400, "En démo, seuls les fichiers CSV et JSON sont pris en charge.")
  }
  const parsed = extension === "csv" ? parseCsv(await file.text()) : parseJson(await file.text())
  if (parsed.error) throw new DemoApiError(400, "Fichier illisible ou mal formé")
  if (parsed.rows.length === 0) throw new DemoApiError(400, "Aucun étudiant trouvé dans le fichier")
  return enrollStudents(db, promotion, parsed.rows)
}

/**
 * Point d’entrée : traite une requête /api/... localement.
 * Retourne null si l’URL ne concerne pas l’API (on laisse passer le fetch réel).
 */
export async function handleDemoRequest(method: string, url: string, init?: RequestInit): Promise<Response | null> {
  const parsed = new URL(url)
  const path = parsed.pathname
  if (!path.startsWith("/api/")) return null

  const db = loadDemoDb()
  const route = path.slice("/api".length).replace(/\/$/, "") || "/"
  const query = parsed.searchParams
  const headers = new Headers(init?.headers)
  let body: Record<string, any>
  let form: FormData | null = null
  if (init?.body instanceof FormData) {
    form = init.body
    body = {}
  } else {
    body = await readBody(init)
  }

  try {
    if (route === "/auth/login" && method === "POST") {
      const email = String(body.email ?? "").toLowerCase()
      const account = Object.values(DEMO_ACCOUNTS).find((a) => a.email === email)
      if (!account) return fail(401, "Compte de démo inconnu. Utilisez les boutons de connexion démo.")
      const user = db.users.find((u) => u.email === account.email)
      if (!user) return fail(401, "Compte de démo introuvable dans la base locale.")
      if (!user.isActive) return fail(401, "Identifiants invalides")
      return json({ user: serializeUser(db, user), token: `demo-token-${user.id}`, refreshToken: "demo-refresh-token" })
    }
    if (route === "/auth/verify" && method === "GET") {
      const user = requireUser(db, init, headers)
      return json({ valid: true, user: serializeUser(db, user) })
    }
    if (route === "/auth/refresh" && method === "POST") {
      return json({ token: readToken(init, headers) ?? "", refreshToken: "demo-refresh-token" })
    }

    // ---------- UTILISATEURS (enseignant) ----------
    if ((route === "/users/students" || route === "/users/teachers") && method === "GET") {
      requireTeacher(db, init, headers)
      const role = route === "/users/students" ? "student" : "teacher"
      const byName = (a: DemoUser, b: DemoUser) => a.lastName.localeCompare(b.lastName, "fr") || a.firstName.localeCompare(b.firstName, "fr")
      return json(db.users.filter((u) => u.role === role).sort(byName).map((u) => serializeUser(db, u)))
    }
    let m = /^\/users\/(\d+)\/(deactivate|activate)$/.exec(route)
    if (m && method === "PUT") {
      requireTeacher(db, init, headers)
      const user = db.users.find((u) => u.id === Number(m![1]))
      if (!user) return fail(404, "Utilisateur introuvable")
      if (user.role !== "student") return fail(403, "Seuls les comptes étudiants peuvent être désactivés ou réactivés")
      user.isActive = m![2] === "activate"
      persist()
      return json(serializeUser(db, user))
    }

    // ---------- PROMOTIONS (enseignant) ----------
    if (route === "/promotions/my" && method === "GET") {
      const teacher = requireTeacher(db, init, headers)
      const promotions = db.promotions.filter((p) => p.teacherId === teacher.id)
      return json(promotions.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        year: p.year,
        createdAt: p.createdAt,
        students: p.studentIds.map((id) => serializeUser(db, id)),
        projects: db.projects.filter((pr) => pr.promotionId === p.id).map((pr) => ({ id: pr.id, name: pr.name })),
      })))
    }
    if (route === "/promotions" && method === "POST") {
      const teacher = requireTeacher(db, init, headers)
      if (!String(body.name ?? "").trim()) return fail(400, "Nom de la promotion requis")
      if (!isValidYear(body.year)) return fail(400, "Année invalide")
      const promotion = {
        id: nextId(db),
        name: String(body.name).trim(),
        description: String(body.description ?? ""),
        year: Number(body.year),
        teacherId: teacher.id,
        studentIds: [],
        createdAt: new Date().toISOString(),
      }
      db.promotions.push(promotion)
      persist()
      return json({ ...promotion, students: [], projects: [] }, 201)
    }
    m = /^\/promotions\/(\d+)$/.exec(route)
    if (m && method === "PUT") {
      const owner = requireTeacher(db, init, headers)
      assertOwnsPromotion(db, owner, Number(m![1]))
      const promotion = db.promotions.find((p) => p.id === Number(m![1]))
      if (!promotion) return fail(404, "Promotion introuvable.")
      if (body.name !== undefined && !String(body.name).trim()) return fail(400, "Nom de promotion invalide")
      if (body.year !== undefined && !isValidYear(body.year)) return fail(400, "Année invalide")
      if (body.name !== undefined) promotion.name = String(body.name).trim()
      if (body.description !== undefined) promotion.description = String(body.description)
      if (body.year !== undefined) promotion.year = Number(body.year)
      persist()
      return json({ ...promotion, students: promotion.studentIds.map((id) => serializeUser(db, id)) })
    }
    if (m && method === "DELETE") {
      const owner = requireTeacher(db, init, headers)
      assertOwnsPromotion(db, owner, Number(m![1]))
      const index = db.promotions.findIndex((p) => p.id === Number(m![1]))
      if (index === -1) return fail(404, "Promotion introuvable.")
      if (db.projects.some((p) => p.promotionId === Number(m![1]))) {
        return fail(409, "Cette promotion contient des projets : supprimez-les d’abord.")
      }
      db.promotions.splice(index, 1)
      persist()
      return ok()
    }
    m = /^\/promotions\/(\d+)\/students$/.exec(route)
    if (m && method === "POST") {
      const owner = requireTeacher(db, init, headers)
      assertOwnsPromotion(db, owner, Number(m![1]))
      const promotion = db.promotions.find((p) => p.id === Number(m![1]))
      if (!promotion) return fail(404, "Promotion introuvable.")
      if (!Array.isArray(body)) return fail(400, "Un tableau d'étudiants est attendu")
      return json(enrollStudents(db, promotion, body as StudentEntry[]), 201)
    }
    m = /^\/promotions\/(\d+)\/students\/(\d+)$/.exec(route)
    if (m && method === "DELETE") {
      const owner = requireTeacher(db, init, headers)
      assertOwnsPromotion(db, owner, Number(m![1]))
      const promotion = db.promotions.find((p) => p.id === Number(m![1]))
      if (!promotion) return fail(404, "Promotion introuvable.")
      const studentId = Number(m![2])
      promotion.studentIds = promotion.studentIds.filter((id) => id !== studentId)
      // Comme l’API : un étudiant retiré de la promotion quitte aussi les groupes de ses projets.
      const promotionProjectIds = db.projects.filter((p) => p.promotionId === promotion.id).map((p) => p.id)
      for (const group of db.groups) {
        if (promotionProjectIds.includes(group.projectId)) group.memberIds = group.memberIds.filter((id) => id !== studentId)
      }
      persist()
      return ok()
    }
    m = /^\/promotions\/(\d+)\/students\/import$/.exec(route)
    if (m && method === "POST" && form) {
      const owner = requireTeacher(db, init, headers)
      assertOwnsPromotion(db, owner, Number(m![1]))
      const file = formDataFile(form)
      if (!file) return fail(400, "Aucun fichier reçu.")
      const promotion = db.promotions.find((p) => p.id === Number(m![1]))
      if (!promotion) return fail(404, "Promotion introuvable.")
      return json(await importStudentFile(db, promotion, file))
    }

    if (route === "/projects/my" && method === "GET") {
      const user = requireUser(db, init, headers)
      if (user.role === "teacher") {
        const projects = db.projects.filter((p) => p.teacherId === user.id)
        return json(projects.map((p) => serializeProjectSummary(db, p)))
      }
      const myPromotions = db.promotions.filter((p) => p.studentIds.includes(user.id))
      const projects = db.projects.filter(
        (p) => p.status === "visible" && myPromotions.some((promo) => promo.id === p.promotionId)
      )
      return json(projects.map((p) => serializeProjectSummary(db, p)))
    }
    m = /^\/projects\/(\d+)$/.exec(route)
    if (m && method === "GET") {
      const user = requireUser(db, init, headers)
      const project = db.projects.find((p) => p.id === Number(m![1]))
      if (!project) return fail(404, "Projet introuvable.")
      if (!canAccessProject(db, user, project.id)) {
        return fail(403, user.role === "student" ? "Vous n’avez pas accès à ce projet." : "Ce projet appartient à un autre enseignant.")
      }
      return json(serializeProjectDetail(db, project, user))
    }
    if (route === "/projects" && method === "POST") {
      const teacher = requireTeacher(db, init, headers)
      const promotion = db.promotions.find((p) => p.id === Number(body.promotionId))
      if (!promotion) return fail(400, "Promotion introuvable")
      if (promotion.teacherId !== teacher.id) return fail(403, "Cette promotion appartient à un autre enseignant")
      if (Number(body.minGroupSize) > Number(body.maxGroupSize)) return fail(400, "La taille minimale des groupes dépasse la taille maximale")
      const project: DemoProject = {
        id: nextId(db),
        name: String(body.name ?? "Nouveau projet"),
        description: String(body.description ?? ""),
        status: body.status === "visible" ? "visible" : "draft",
        minGroupSize: Number(body.minGroupSize) || 2,
        maxGroupSize: Number(body.maxGroupSize) || 4,
        groupFormationRule: (["manual", "random", "free"].includes(String(body.groupFormationRule)) ? body.groupFormationRule : "manual") as DemoProject["groupFormationRule"],
        groupFormationDeadline: body.groupFormationDeadline || null,
        promotionId: promotion.id,
        teacherId: teacher.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      db.projects.push(project)
      persist()
      return json(serializeProjectSummary(db, project), 201)
    }
    if (m && (method === "PUT" || method === "PATCH")) {
      const teacher = requireTeacher(db, init, headers)
      assertOwnsProject(db, teacher, Number(m![1]))
      const project = db.projects.find((p) => p.id === Number(m![1]))
      if (!project) return fail(404, "Projet introuvable.")
      const minSize = body.minGroupSize !== undefined ? Number(body.minGroupSize) : project.minGroupSize
      const maxSize = body.maxGroupSize !== undefined ? Number(body.maxGroupSize) : project.maxGroupSize
      if (minSize && maxSize && minSize > maxSize) return fail(400, "La taille minimale des groupes dépasse la taille maximale")
      if (body.promotionId !== undefined) {
        const promotion = db.promotions.find((p) => p.id === Number(body.promotionId))
        if (!promotion) return fail(400, "Promotion introuvable")
        if (promotion.teacherId !== teacher.id) return fail(403, "Cette promotion appartient à un autre enseignant")
      }
      for (const key of ["name", "description", "status", "groupFormationRule"] as const) {
        if (body[key] !== undefined) (project as any)[key] = body[key]
      }
      if (body.groupFormationDeadline !== undefined) project.groupFormationDeadline = body.groupFormationDeadline || null
      for (const key of ["minGroupSize", "maxGroupSize", "promotionId"] as const) {
        if (body[key] !== undefined) (project as any)[key] = Number(body[key])
      }
      project.updatedAt = new Date().toISOString()
      persist()
      return json(serializeProjectDetail(db, project, teacher))
    }
    if (m && method === "DELETE") {
      const id = Number(m![1])
      assertOwnsProject(db, requireTeacher(db, init, headers), id)
      const index = db.projects.findIndex((p) => p.id === id)
      if (index === -1) return fail(404, "Projet introuvable.")
      db.projects.splice(index, 1)
      db.groups = db.groups.filter((g) => g.projectId !== id)
      db.deliverables = db.deliverables.filter((d) => d.projectId !== id)
      db.defenses = db.defenses.filter((d) => d.projectId !== id)
      db.reports = db.reports.filter((r) => r.projectId !== id)
      db.grids = db.grids.filter((g) => g.projectId !== id)
      persist()
      return ok()
    }
    m = /^\/projects\/(\d+)\/groups$/.exec(route)
    if (m && method === "PUT") {
      const owner = requireTeacher(db, init, headers)
      assertOwnsProject(db, owner, Number(m![1]))
      const projectId = Number(m![1])
      const project = db.projects.find((p) => p.id === projectId)
      if (!project) return fail(404, "Projet introuvable.")
      const groupsPayload: Array<{ id: number; memberIds: number[] }> = body.groups ?? []
      const enrolled = db.promotions.find((p) => p.id === project.promotionId)?.studentIds ?? []
      const placed = new Set<number>()
      for (const memberId of groupsPayload.flatMap((g) => g.memberIds.map(Number))) {
        if (!enrolled.includes(memberId)) return fail(400, "Un des étudiants n’appartient pas à la promotion du projet")
        if (placed.has(memberId)) return fail(400, "Un étudiant ne peut appartenir qu’à un seul groupe")
        placed.add(memberId)
      }
      for (const groupData of groupsPayload) {
        const memberIds = groupData.memberIds.map(Number).filter((v) => Number.isFinite(v))
        const existing = db.groups.find((g) => g.id === Number(groupData.id) && g.projectId === projectId)
        if (existing) {
          existing.memberIds = memberIds
        } else {
          db.groups.push({
            id: nextId(db),
            projectId,
            name: nextGroupName(db, projectId),
            memberIds,
          })
        }
      }
      // Groupes retirés du board : détachés sans suppression (soumissions/rapports conservés)
      for (const group of db.groups.filter((g) => g.projectId === projectId)) {
        if (!groupsPayload.some((g) => Number(g.id) === group.id) && group.memberIds.length > 0) {
          group.memberIds = []
        }
      }
      persist()
      return json({
        message: "Répartition des groupes enregistrée (démo).",
        updatedGroups: groupsPayload.length,
        affectedLinks: groupsPayload.reduce((sum, g) => sum + g.memberIds.length, 0),
      })
    }

    m = /^\/groups\/project\/(\d+)$/.exec(route)
    if (m && method === "POST") {
      const user = requireUser(db, init, headers)
      const projectId = Number(m![1])
      if (!db.projects.some((p) => p.id === projectId) || !canAccessProject(db, user, projectId)) {
        return fail(404, "Projet introuvable")
      }
      const project = db.projects.find((p) => p.id === projectId)!
      let members: number[] = []
      if (user.role === "student") {
        const closed = freeFormationClosed(project)
        if (closed) return fail(403, closed)
        if (db.groups.some((g) => g.projectId === projectId && g.memberIds.includes(user.id))) {
          return fail(409, "Vous appartenez déjà à un groupe de ce projet")
        }
        members = [user.id]
      }
      const group: DemoGroup = { id: nextId(db), projectId, name: nextGroupName(db, projectId), memberIds: members }
      db.groups.push(group)
      persist()
      return json(serializeGroup(db, group), 201)
    }

    m = /^\/groups\/(\d+)\/join$/.exec(route)
    if (m && method === "POST") {
      const student = requireStudent(db, init, headers)
      const group = db.groups.find((g) => g.id === Number(m![1]))
      if (!group) return fail(404, "Groupe introuvable")
      const project = db.projects.find((p) => p.id === group.projectId)
      if (!project || !canAccessProject(db, student, project.id)) return fail(404, "Projet introuvable")
      const closed = freeFormationClosed(project)
      if (closed) return fail(403, closed)
      if (project.maxGroupSize && group.memberIds.length >= project.maxGroupSize) return fail(403, "Ce groupe est complet")
      if (db.groups.some((g) => g.projectId === project.id && g.memberIds.includes(student.id))) {
        return fail(409, "Vous appartenez déjà à un groupe de ce projet")
      }
      group.memberIds.push(student.id)
      persist()
      return json(serializeGroup(db, group))
    }

    m = /^\/groups\/(\d+)\/leave$/.exec(route)
    if (m && method === "POST") {
      const student = requireStudent(db, init, headers)
      const group = db.groups.find((g) => g.id === Number(m![1]))
      if (!group || !group.memberIds.includes(student.id)) return fail(404, "Groupe introuvable")
      const project = db.projects.find((p) => p.id === group.projectId)
      if (!project || !canAccessProject(db, student, project.id)) return fail(404, "Projet introuvable")
      const closed = freeFormationClosed(project, "quitter")
      if (closed) return fail(403, closed)
      group.memberIds = group.memberIds.filter((id) => id !== student.id)
      persist()
      return json(serializeGroup(db, group))
    }

    m = /^\/groups\/(\d+)$/.exec(route)
    if (m && method === "DELETE") {
      const teacher = requireTeacher(db, init, headers)
      const group = db.groups.find((g) => g.id === Number(m![1]))
      if (!group) return fail(404, "Groupe introuvable")
      assertOwnsProject(db, teacher, group.projectId)
      if (group.memberIds.length > 0) return fail(409, "Ce groupe a encore des membres : déplacez-les avant de le supprimer")
      if (db.submissions.some((s) => s.groupId === group.id) || db.reports.some((r) => r.groupId === group.id)) {
        return fail(409, "Ce groupe a déjà déposé un rendu ou un rapport : il ne peut pas être supprimé")
      }
      db.groups = db.groups.filter((g) => g.id !== group.id)
      db.defenses = db.defenses.filter((d) => d.groupId !== group.id)
      persist()
      return ok()
    }

    if (route === "/deliverables" && method === "POST") {
      assertOwnsProject(db, requireTeacher(db, init, headers), Number(body.projectId))
      const deliverable: DemoDeliverable = {
        id: nextId(db),
        projectId: Number(body.projectId),
        name: String(body.name ?? "Nouveau livrable"),
        description: String(body.description ?? ""),
        type: body.type === "git_link" ? "git_link" : "archive",
        deadline: body.deadline ?? new Date(Date.now() + 14 * 86_400_000).toISOString(),
        allowLateSubmission: Boolean(body.allowLateSubmission),
        penaltyPerHour: Number(body.penaltyPerHour) || 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      db.deliverables.push(deliverable)
      persist()
      return json({
        ...deliverable,
        validationRules: [],
        submissions: [],
      }, 201)
    }
    m = /^\/deliverables\/(\d+)$/.exec(route)
    if (m && (method === "PUT" || method === "PATCH")) {
      const owner = requireTeacher(db, init, headers)
      assertOwnsDeliverable(db, owner, Number(m![1]))
      const deliverable = db.deliverables.find((d) => d.id === Number(m![1]))
      if (!deliverable) return fail(404, "Livrable introuvable.")
      for (const key of ["name", "description", "type", "deadline"] as const) {
        if (body[key] !== undefined) (deliverable as any)[key] = body[key]
      }
      if (body.allowLateSubmission !== undefined) deliverable.allowLateSubmission = Boolean(body.allowLateSubmission)
      if (body.penaltyPerHour !== undefined) deliverable.penaltyPerHour = Number(body.penaltyPerHour) || 0
      deliverable.updatedAt = new Date().toISOString()
      persist()
      return json(deliverable)
    }
    if (m && method === "DELETE") {
      const owner = requireTeacher(db, init, headers)
      assertOwnsDeliverable(db, owner, Number(m![1]))
      const id = Number(m![1])
      if (!db.deliverables.some((d) => d.id === id)) return fail(404, "Livrable introuvable.")
      db.deliverables = db.deliverables.filter((d) => d.id !== id)
      db.rules = db.rules.filter((r) => r.deliverableId !== id)
      db.submissions = db.submissions.filter((s) => s.deliverableId !== id)
      persist()
      return ok()
    }
    m = /^\/deliverables\/(\d+)\/rules$/.exec(route)
    if (m && method === "POST") {
      const owner = requireTeacher(db, init, headers)
      assertOwnsDeliverable(db, owner, Number(m![1]))
      const deliverable = db.deliverables.find((d) => d.id === Number(m![1]))
      if (!deliverable) return fail(404, "Livrable introuvable.")
      const configuration =
        typeof body.configuration === "string" ? body.configuration : JSON.stringify(body.configuration ?? {})
      const rule = {
        id: nextId(db),
        deliverableId: deliverable.id,
        type: body.type ?? "max_size",
        configuration,
        errorMessage: body.errorMessage ?? undefined,
      }
      db.rules.push(rule)
      persist()
      return json(rule, 201)
    }
    m = /^\/deliverables\/(\d+)\/rules\/(\d+)$/.exec(route)
    if (m && (method === "PUT" || method === "PATCH")) {
      const owner = requireTeacher(db, init, headers)
      assertOwnsDeliverable(db, owner, Number(m![1]))
      const rule = db.rules.find((r) => r.id === Number(m![2]))
      if (!rule) return fail(404, "Règle introuvable.")
      if (body.type) rule.type = body.type
      if (body.configuration !== undefined) {
        rule.configuration = typeof body.configuration === "string" ? body.configuration : JSON.stringify(body.configuration)
      }
      if (body.errorMessage !== undefined) rule.errorMessage = body.errorMessage
      persist()
      return json(rule)
    }
    if (m && method === "DELETE") {
      const owner = requireTeacher(db, init, headers)
      assertOwnsDeliverable(db, owner, Number(m![1]))
      if (!db.rules.some((r) => r.id === Number(m![2]))) return fail(404, "Règle introuvable.")
      db.rules = db.rules.filter((r) => r.id !== Number(m![2]))
      persist()
      return ok()
    }
    m = /^\/deliverables\/(\d+)\/validate$/.exec(route)
    if (m && method === "POST" && form) {
      requireStudent(db, init, headers)
      const deliverable = db.deliverables.find((d) => d.id === Number(m![1]))
      if (!deliverable) return fail(404, "Livrable introuvable.")
      const file = formDataFile(form)
      const gitUrl = formDataGitUrl(form)
      if (!file && !gitUrl) return fail(400, "Aucun fichier ni lien Git fourni.")
      return json(evaluateRules(db, deliverable.id, file, gitUrl))
    }
    m = /^\/deliverables\/(\d+)\/submit$/.exec(route)
    if (m && method === "POST" && form) {
      const student = requireStudent(db, init, headers)
      const deliverable = db.deliverables.find((d) => d.id === Number(m![1]))
      if (!deliverable) return fail(404, "Livrable introuvable.")
      const groupId = idsFromForm(form, "groupId")[0]
      const group = db.groups.find((g) => g.id === groupId && g.memberIds.includes(student.id))
      if (!group) return fail(403, "Soumission autorisée uniquement pour votre propre groupe.")
      const file = formDataFile(form)
      const gitUrl = formDataGitUrl(form)
      if (!file && !gitUrl) return fail(400, "Aucun fichier ni lien Git fourni.")

      const now = new Date()
      const late = new Date(deliverable.deadline) < now
      if (late && !deliverable.allowLateSubmission) return fail(403, "La date limite est dépassée et les rendus tardifs ne sont pas autorisés.")

      const validation = evaluateRules(db, deliverable.id, file, gitUrl)
      const hoursLate = Math.ceil((now.getTime() - new Date(deliverable.deadline).getTime()) / 3_600_000)
      // Un nouveau rendu remplace le précédent du groupe, comme dans l’API ; son analyse de ressemblance est à refaire.
      const submission = {
        id: db.submissions.find((s) => s.deliverableId === deliverable.id && s.groupId === group.id)?.id ?? nextId(db),
        deliverableId: deliverable.id,
        groupId: group.id,
        fileName: file?.name ?? undefined,
        fileSize: file?.size ?? undefined,
        gitUrl: gitUrl ?? undefined,
        submittedAt: now.toISOString(),
        isLate: late,
        penalty: late ? Math.round(hoursLate * deliverable.penaltyPerHour * 100) / 100 : 0,
        validationResults: validation.rules,
      }
      db.submissions = [
        ...db.submissions.filter((s) => !(s.deliverableId === deliverable.id && s.groupId === group.id)),
        submission,
      ]
      persist()
      return json(serializeSubmission(db, submission), 201)
    }
    m = /^\/deliverables\/(\d+)\/submissions\/(\d+)$/.exec(route)
    if (m && method === "GET") {
      const owner = requireTeacher(db, init, headers)
      assertOwnsDeliverable(db, owner, Number(m![1]))
      const submission = db.submissions.find((s) => s.deliverableId === Number(m![1]) && s.groupId === Number(m![2]))
      if (!submission) return fail(404, "Aucune soumission pour ce groupe.")
      return json(serializeSubmission(db, submission, true))
    }
    m = /^\/deliverables\/(\d+)\/analyze-similarity$/.exec(route)
    if (m && method === "POST") {
      const owner = requireTeacher(db, init, headers)
      assertOwnsDeliverable(db, owner, Number(m![1]))
      const submissions = db.submissions.filter((s) => s.deliverableId === Number(m![1]))
      // La démo ne lit pas les fichiers : les scores d’exemple restent tels quels.
      return json({ message: "Démo : les rendus ne sont pas lus, les scores d’exemple restent inchangés.", analyzed: submissions.length, skipped: 0 })
    }
    m = /^\/deliverables\/submissions\/(\d+)\/download$/.exec(route)
    if (m && method === "GET") {
      requireUser(db, init, headers)
      return fail(501, "Téléchargement désactivé en démo.")
    }
    m = /^\/submissions\/(\d+)\/similarity$/.exec(route)
    if (m && method === "GET") {
      requireTeacher(db, init, headers)
      const submission = db.submissions.find((s) => s.id === Number(m![1]))
      if (!submission) return fail(404, "Soumission introuvable.")
      const others = db.submissions.filter((s) => s.deliverableId === submission.deliverableId && s.id !== submission.id)
      return json({
        submission: { id: submission.id, similarityScore: submission.similarityScore ?? 0 },
        topMatches: others.map((other) => ({
          submissionId1: submission.id,
          submissionId2: other.id,
          finalScore: Math.min(submission.similarityScore ?? 0, other.similarityScore ?? 0),
          textScore: Math.min(submission.similarityScore ?? 0, other.similarityScore ?? 0),
          filePath1: submission.fileName ?? submission.gitUrl ?? "",
          filePath2: other.fileName ?? other.gitUrl ?? "",
          details: "Comparaison simulée en démo.",
        })),
      })
    }
    // ---------- SOUTENANCES (enseignant) ----------
    m = /^\/defenses\/projects\/(\d+)\/schedule$/.exec(route)
    if (m && method === "POST") {
      const owner = requireTeacher(db, init, headers)
      assertOwnsProject(db, owner, Number(m![1]))
      const projectId = Number(m![1])
      const groups = db.groups.filter((g) => g.projectId === projectId && g.memberIds.length > 0).sort((a, b) => a.id - b.id)
      if (groups.length === 0) return fail(400, "Constituez d’abord des groupes d’étudiants pour planifier les soutenances.")
      const start = new Date(body.startDateTime)
      if (Number.isNaN(start.getTime())) return fail(400, "Date de début invalide.")
      const durationMinutes = Number(body.durationPerGroup) ||
        (body.endDateTime ? Math.max(10, Math.floor((new Date(body.endDateTime).getTime() - start.getTime()) / 60_000 / groups.length)) : 30)
      const pauseMinutes = body.breakMinutes === undefined || body.breakMinutes === null ? 5 : Number(body.breakMinutes)
      if (!(pauseMinutes >= 0 && pauseMinutes <= 120)) return fail(400, "Pause invalide (0 à 120 minutes).")

      // Comme l’API : on garde les soutenances commencées, l’ordre actuel et les consignes ; les nouveaux groupes passent à la fin.
      const now = Date.now()
      const existing = db.defenses.filter((d) => d.projectId === projectId).sort((a, b) => a.orderIndex - b.orderIndex)
      const finished = existing.filter((d) => new Date(d.startTime).getTime() <= now)
      const upcoming = existing.filter((d) => !finished.includes(d))
      const finishedGroups = new Set(finished.map((d) => d.groupId))
      const position = new Map(upcoming.map((d, index) => [d.groupId, index]))
      const toSchedule = groups
        .filter((g) => !finishedGroups.has(g.id))
        .sort((a, b) => (position.get(a.id) ?? Infinity) - (position.get(b.id) ?? Infinity) || a.id - b.id)
      if (toSchedule.length === 0) return fail(400, "Toutes les soutenances ont déjà commencé ou eu lieu : il n’y a plus rien à planifier.")
      const instructions =
        body.instructions === undefined ? (existing.find((d) => d.instructions)?.instructions ?? null) : String(body.instructions ?? "").trim() || null

      db.defenses = db.defenses.filter((d) => d.projectId !== projectId || finished.includes(d))
      toSchedule.forEach((group, i) => {
        const slotStart = new Date(start.getTime() + i * (durationMinutes + pauseMinutes) * 60_000)
        db.defenses.push({
          id: nextId(db),
          projectId,
          groupId: group.id,
          startTime: slotStart.toISOString(),
          endTime: new Date(slotStart.getTime() + durationMinutes * 60_000).toISOString(),
          orderIndex: finished.length + i + 1,
          location: body.location ? String(body.location) : null,
          instructions,
        })
      })
      const defenses = db.defenses
        .filter((d) => d.projectId === projectId)
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      defenses.forEach((d, i) => (d.orderIndex = i + 1))
      persist()
      return json({ message: "Soutenances planifiées", defenses: defenses.map((d) => serializeDefense(db, d)) }, 201)
    }
    m = /^\/defenses\/projects\/(\d+)\/reorder$/.exec(route)
    if (m && method === "PUT") {
      const owner = requireTeacher(db, init, headers)
      assertOwnsProject(db, owner, Number(m![1]))
      const projectId = Number(m![1])
      const newOrder: Array<{ groupId: number; orderIndex: number }> = body.newOrder ?? []
      const current = db.defenses
        .filter((d) => d.projectId === projectId)
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime() || a.orderIndex - b.orderIndex)
      if (current.length === 0) return fail(400, "Aucune soutenance n’est planifiée.")
      // Comme l’API : chaque groupe prend l’horaire de sa nouvelle place ; une soutenance commencée ou passée reste à la sienne.
      const requested = new Map(newOrder.map((item) => [Number(item.groupId), Number(item.orderIndex)]))
      const wanted = (d: (typeof current)[number]) => requested.get(d.groupId) ?? current.indexOf(d) + 1
      const next = [...current].sort((a, b) => wanted(a) - wanted(b) || current.indexOf(a) - current.indexOf(b))
      const now = Date.now()
      if (current.some((d, i) => new Date(d.startTime).getTime() <= now && next[i] !== d)) {
        return fail(400, "Une soutenance commencée ou passée ne peut plus être déplacée.")
      }
      const slots = current.map(({ startTime, endTime }) => ({ startTime, endTime }))
      next.forEach((d, i) => Object.assign(d, slots[i], { orderIndex: i + 1 }))
      persist()
      return json({ defenses: next.map((d) => serializeDefense(db, d)) })
    }
    m = /^\/defenses\/projects\/(\d+)\/(schedule\/pdf|attendance\/pdf)$/.exec(route)
    if (m && method === "GET") {
      const owner = requireTeacher(db, init, headers)
      assertOwnsProject(db, owner, Number(m![1]))
      return fail(501, "Export PDF désactivé en démo.")
    }

    if (route === "/grading/grids" && method === "POST") {
      assertOwnsProject(db, requireTeacher(db, init, headers), Number(body.projectId))
      if (body.deliverableId && !db.deliverables.some((d) => d.id === Number(body.deliverableId) && d.projectId === Number(body.projectId))) {
        return fail(400, "Ce livrable n’appartient pas au projet")
      }
      const grid = {
        id: nextId(db),
        projectId: Number(body.projectId),
        name: String(body.name ?? "Nouvelle grille"),
        type: (body.type ?? "deliverable") as "deliverable" | "report" | "defense",
        weight: body.weight === undefined ? 1 : Number(body.weight),
        description: body.description,
        deliverableId: body.deliverableId ? Number(body.deliverableId) : undefined,
        criteria: [],
      }
      db.grids.push(grid)
      persist()
      return json(serializeGrid(db, grid), 201)
    }
    m = /^\/grading\/grids\/(\d+)$/.exec(route)
    if (m && (method === "PUT" || method === "PATCH")) {
      requireTeacher(db, init, headers)
      const grid = db.grids.find((g) => g.id === Number(m![1]))
      if (!grid) return fail(404, "Grille introuvable.")
      if (body.name) grid.name = String(body.name)
      if (body.description !== undefined) grid.description = body.description
      if (body.weight !== undefined) grid.weight = Number(body.weight)
      if (body.type) grid.type = body.type
      if (body.deliverableId !== undefined) grid.deliverableId = Number(body.deliverableId) || undefined
      persist()
      return json(serializeGrid(db, grid))
    }
    if (m && method === "DELETE") {
      requireTeacher(db, init, headers)
      const id = Number(m![1])
      if (!db.grids.some((g) => g.id === id)) return fail(404, "Grille introuvable.")
      db.grids = db.grids.filter((g) => g.id !== id)
      db.sessions = db.sessions.filter((s) => s.gridId !== id)
      persist()
      return json({ success: true })
    }
    m = /^\/grading\/projects\/(\d+)\/grids$/.exec(route)
    if (m && method === "GET") {
      const owner = requireTeacher(db, init, headers)
      assertOwnsProject(db, owner, Number(m![1]))
      const type = query.get("type")
      let grids = db.grids.filter((g) => g.projectId === Number(m![1]))
      if (type) grids = grids.filter((g) => g.type === type)
      return json(grids.map((g) => serializeGrid(db, g)))
    }
    m = /^\/grading\/grids\/(\d+)\/criteria$/.exec(route)
    if (m && method === "POST") {
      requireTeacher(db, init, headers)
      const grid = db.grids.find((g) => g.id === Number(m![1]))
      if (!grid) return fail(404, "Grille introuvable.")
      const criterion = {
        id: nextId(db),
        gridId: grid.id,
        name: String(body.name ?? "Nouveau critère"),
        description: body.description,
        maxScore: Number(body.maxScore) || 20,
        weight: Number(body.weight) || 1,
        type: (body.type ?? "group") as "group" | "individual",
        hasComments: Boolean(body.hasComments),
      }
      grid.criteria.push(criterion)
      persist()
      return json({ ...criterion, gridId: grid.id }, 201)
    }
    m = /^\/grading\/criteria\/(\d+)$/.exec(route)
    if (m && (method === "PUT" || method === "PATCH")) {
      requireTeacher(db, init, headers)
      const grid = db.grids.find((g) => g.criteria.some((c) => c.id === Number(m![1])))
      const criterion = grid?.criteria.find((c) => c.id === Number(m![1]))
      if (!criterion) return fail(404, "Critère introuvable.")
      if (body.name) criterion.name = String(body.name)
      if (body.description !== undefined) criterion.description = body.description
      if (body.maxScore !== undefined) criterion.maxScore = Number(body.maxScore)
      if (body.weight !== undefined) criterion.weight = Number(body.weight)
      if (body.hasComments !== undefined) criterion.hasComments = Boolean(body.hasComments)
      if (grid) recomputeTotals(db, grid.id)
      persist()
      return json(criterion)
    }
    if (m && method === "DELETE") {
      requireTeacher(db, init, headers)
      const grid = db.grids.find((g) => g.criteria.some((c) => c.id === Number(m![1])))
      if (!grid) return fail(404, "Critère introuvable.")
      grid.criteria = grid.criteria.filter((c) => c.id !== Number(m![1]))
      db.sessions.forEach((s) => {
        s.entries = s.entries.filter((e) => e.criterionId !== Number(m![1]))
      })
      recomputeTotals(db, grid.id)
      persist()
      return json({ success: true })
    }
    if (route === "/grading/sessions" && method === "GET") {
      const user = requireUser(db, init, headers)
      const gridId = query.get("gridId")
      const groupId = query.get("groupId")
      const projectId = query.get("projectId")
      const type = query.get("type")
      let sessions = db.sessions
      if (gridId) sessions = sessions.filter((s) => s.gridId === Number(gridId))
      if (groupId) sessions = sessions.filter((s) => s.groupId === Number(groupId))
      if (projectId) sessions = sessions.filter((s) => db.grids.some((g) => g.id === s.gridId && g.projectId === Number(projectId)))
      if (type) sessions = sessions.filter((s) => db.grids.some((g) => g.id === s.gridId && g.type === type))
      if (user.role === "student") {
        const myGroups = db.groups.filter((g) => g.memberIds.includes(user.id))
        sessions = sessions.filter((s) => myGroups.some((g) => g.id === s.groupId) && isPublished(s))
      }
      return json(sessions.map((s) => serializeSession(s)))
    }
    if (route === "/grading/sessions" && method === "POST") {
      const teacher = requireTeacher(db, init, headers)
      return json(serializeSession(upsertSession(db, teacher, body)), 201)
    }
    m = /^\/grading\/sessions\/(\d+)$/.exec(route)
    if (m && (method === "PUT" || method === "PATCH")) {
      const teacher = requireTeacher(db, init, headers)
      const session = db.sessions.find((s) => s.id === Number(m![1]))
      if (!session) return fail(404, "Session de notation introuvable.")
      return json(serializeSession(upsertSession(db, teacher, { ...body, id: session.id })))
    }
    m = /^\/grading\/students\/my-grades$/.exec(route)
    if (m && method === "GET") {
      const student = requireStudent(db, init, headers)
      return json(myGrades(db, student))
    }
    if (route === "/grading/students/my-summary" && method === "GET") {
      return json(myOverview(db, requireStudent(db, init, headers)))
    }
    m = /^\/grading\/projects\/(\d+)\/summary$/.exec(route)
    if (m && method === "GET") {
      const owner = requireTeacher(db, init, headers)
      assertOwnsProject(db, owner, Number(m![1]))
      return json(buildSummary(db, Number(m![1])))
    }
    m = /^\/grading\/projects\/(\d+)\/weights$/.exec(route)
    if (m && method === "PUT") {
      const owner = requireTeacher(db, init, headers)
      assertOwnsProject(db, owner, Number(m![1]))
      const weights: Array<{ id?: number; gridId?: number; weight: number }> = body.weights ?? []
      for (const w of weights) {
        const gridId = Number(w.id ?? w.gridId)
        const grid = db.grids.find((g) => g.id === gridId)
        if (grid) grid.weight = Number(w.weight)
      }
      persist()
      return json({ success: true })
    }
    m = /^\/grading\/projects\/(\d+)\/export$/.exec(route)
    if (m && method === "GET") {
      const owner = requireTeacher(db, init, headers)
      assertOwnsProject(db, owner, Number(m![1]))
      const projectId = Number(m![1])
      const summary = buildSummary(db, projectId)
      const rows = [["Groupe", "Grille", "Note", "Statut"]]
      for (const group of summary.groups) {
        for (const grade of group.grades) {
          rows.push([
            group.name,
            grade.gridName,
            String(grade.totalScore).replace(".", ","),
            grade.isValidated ? "validée" : "brouillon",
          ])
        }
      }
      const csv = rows.map((r) => r.join(";")).join("\n")
      return new Response(`\uFEFF${csv}`, {
        status: 200,
        headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="notes-export-demo.csv"' },
      })
    }
    if (route === "/grading/grades/publish" && method === "POST") {
      const owner = requireTeacher(db, init, headers)
      const projectId = Number(body.projectId)
      assertOwnsProject(db, owner, projectId)
      const grids = db.grids.filter((g) => g.projectId === projectId && (!body.gridId || g.id === Number(body.gridId)))
      const groups = db.groups.filter((g) => g.projectId === projectId && (!body.groupId || g.id === Number(body.groupId)))
      const now = new Date().toISOString()
      let published = 0
      for (const session of db.sessions) {
        if (session.status !== "validated" || session.publishedAt) continue
        if (!grids.some((g) => g.id === session.gridId) || !groups.some((g) => g.id === session.groupId)) continue
        session.publishedAt = now
        published += 1
      }
      persist()
      return json({ published })
    }

    m = /^\/reports\/projects\/(\d+)$/.exec(route)
    if (m && method === "GET") {
      const owner = requireTeacher(db, init, headers)
      assertOwnsProject(db, owner, Number(m![1]))
      return json(db.reports.filter((r) => r.projectId === Number(m![1])).map((r) => serializeReport(db, r)))
    }
    m = /^\/reports\/projects\/(\d+)\/report-config$/.exec(route)
    if (m && (method === "GET" || method === "POST" || method === "PUT")) {
      const projectId = Number(m![1])
      const viewer = requireUser(db, init, headers)
      if (!canAccessProject(db, viewer, projectId)) return fail(403, "Vous n’avez pas accès à ce projet.")
      let config = db.reportConfigs.find((c) => c.projectId === projectId)
      if (!config && method === "GET") {
        return json({ projectId, isEnabled: false, format: "markdown", deadline: null, instructions: null, sections: [] })
      }
      if (!config) {
        config = { projectId, isEnabled: false, format: "markdown", deadline: null, sections: [] }
        db.reportConfigs.push(config)
      }
      if (method === "POST" || method === "PUT") {
        const owner = requireTeacher(db, init, headers)
        assertOwnsProject(db, owner, Number(m![1]))
        if (Array.isArray(body.sections) && body.sections.some((s: any) => !String(s.title ?? "").trim())) {
          return fail(400, "Titre de section requis")
        }
        if (body.isEnabled !== undefined) config.isEnabled = Boolean(body.isEnabled)
        if (body.format) config.format = body.format
        if (body.deadline !== undefined) config.deadline = body.deadline || null
        if (body.instructions !== undefined) config.instructions = body.instructions
        if (Array.isArray(body.sections)) {
          config.sections = body.sections.map((s: any, i: number) => ({
            id: Number(s.id) || nextId(db),
            title: String(s.title).trim(),
            description: s.description ?? "",
            required: Boolean(s.required),
            wordLimit: s.wordLimit ? Number(s.wordLimit) : undefined,
            order: i + 1,
          }))
          // Comme l’API : une section retirée de la liste disparaît avec les textes déjà rédigés.
          const kept = new Set(config.sections.map((sec) => sec.id))
          for (const report of db.reports) {
            if (report.projectId === projectId) report.sections = report.sections.filter((sec) => kept.has(sec.sectionConfigId))
          }
        }
        persist()
      }
      return json({
        ...config,
        id: config.projectId,
        deadline: config.deadline ?? null,
        instructions: config.instructions ?? null,
        sections: [...config.sections].sort((a, b) => a.order - b.order).map((sec) => ({ ...sec, wordLimit: sec.wordLimit ?? null })),
      })
    }
    m = /^\/reports\/section-config\/(\d+)$/.exec(route)
    if (m && (method === "PUT" || method === "PATCH")) {
      requireTeacher(db, init, headers)
      const config = db.reportConfigs.find((c) => c.sections.some((s) => s.id === Number(m![1])))
      const section = config?.sections.find((s) => s.id === Number(m![1]))
      if (!section) return fail(404, "Section introuvable.")
      if (body.title) section.title = String(body.title)
      if (body.description !== undefined) section.description = body.description
      if (body.required !== undefined) section.required = Boolean(body.required)
      if (body.wordLimit !== undefined) section.wordLimit = body.wordLimit ? Number(body.wordLimit) : undefined
      persist()
      return json(section)
    }
    m = /^\/reports\/groups\/(\d+)\/projects\/(\d+)$/.exec(route)
    if (m && method === "GET") {
      const user = requireUser(db, init, headers)
      const groupId = Number(m![1])
      if (user.role === "student") {
        const group = db.groups.find((g) => g.id === groupId)
        if (!group?.memberIds.includes(user.id)) return fail(403, "Vous n’avez pas accès au rapport d’un autre groupe.")
      }
      const report = db.reports.find((r) => r.groupId === groupId && r.projectId === Number(m![2]))
      if (!report) return fail(404, "Aucun rapport pour ce groupe.")
      return json(serializeReport(db, report))
    }
    m = /^\/reports\/groups\/(\d+)\/projects\/(\d+)\/submit$/.exec(route)
    if (m && method === "POST") {
      const student = requireStudent(db, init, headers)
      const group = db.groups.find((g) => g.id === Number(m![1]) && g.projectId === Number(m![2]))
      if (!group?.memberIds.includes(student.id)) return fail(403, "Soumission autorisée uniquement pour votre groupe.")
      const report = findOrCreateReport(db, group)
      if (report.status === "submitted") return fail(409, "Le rapport a déjà été rendu")
      const config = db.reportConfigs.find((c) => c.projectId === group.projectId)
      if (!config?.isEnabled) return fail(403, "Le rapport n’est pas ouvert pour ce projet")
      if (config.deadline && new Date(config.deadline).getTime() < Date.now()) {
        return fail(403, "La date limite est dépassée : le rapport ne peut plus être rendu")
      }
      const missing = config.sections.filter(
        (sec) => sec.required && !report.sections.some((item) => item.sectionConfigId === sec.id && htmlText(item.content) !== ""),
      )
      if (missing.length > 0) return fail(400, `Sections obligatoires non remplies : ${missing.map((sec) => sec.title).join(", ")}`)
      report.status = "submitted"
      report.submittedAt = new Date().toISOString()
      persist()
      return json({ success: true, status: report.status, submittedAt: report.submittedAt })
    }
    m = /^\/reports\/sections\/(\d+)\/content$/.exec(route)
    if (m && method === "PUT") {
      const student = requireStudent(db, init, headers)
      const sectionConfigId = Number(m![1])
      const group = db.groups.find((g) => g.id === Number(body.groupId))
      if (!group?.memberIds.includes(student.id)) return fail(403, "Modification autorisée uniquement pour votre groupe.")
      const config = db.reportConfigs.find((c) => c.projectId === group.projectId && c.sections.some((sec) => sec.id === sectionConfigId))
      if (!config) return fail(404, "Section introuvable")
      if (!config.isEnabled) return fail(403, "Le rapport n’est pas ouvert pour ce projet")
      if (config.deadline && new Date(config.deadline).getTime() < Date.now()) {
        return fail(403, "La date limite est dépassée : le rapport est en lecture seule")
      }
      const report = findOrCreateReport(db, group)
      if (report.status === "submitted") return fail(403, "Le rapport a déjà été rendu")
      const content = String(body.content ?? "")
      let section = report.sections.find((s) => s.sectionConfigId === sectionConfigId)
      // Comme l’API : on ne remplace pas le texte d’un coéquipier enregistré depuis la version que l’étudiant a sous les yeux.
      if (section && body.baseUpdatedAt !== undefined && section.content !== content && section.updatedBy?.id !== student.id) {
        const seen = body.baseUpdatedAt ? new Date(body.baseUpdatedAt).getTime() : null
        if (seen !== new Date(section.updatedAt).getTime()) {
          return fail(409, "Un autre membre du groupe a enregistré une version plus récente de cette section")
        }
      }
      if (!section) {
        section = { sectionConfigId, content: "", updatedAt: "" }
        report.sections.push(section)
      }
      section.content = content
      section.updatedAt = new Date().toISOString()
      section.updatedBy = { id: student.id, firstName: student.firstName, lastName: student.lastName }
      persist()
      return json(section)
    }
    m = /^\/reports\/(\d+)\/export$/.exec(route)
    if (m && method === "GET") {
      requireUser(db, init, headers)
      return fail(501, "Export PDF désactivé en démo.")
    }
    return fail(404, `Route non disponible en démo : ${method} ${path}`)
  } catch (error) {
    if (error instanceof DemoApiError) {
      return fail(error.status, error.message)
    }
    return fail(500, "Erreur interne de la démo.")
  }
}
