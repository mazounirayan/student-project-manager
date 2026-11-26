/**
 * Routeur de démonstration : répond aux appels /api/... à partir de la base
 * fictive stockée dans le localStorage. Aucun réseau : tout est local.
 */
import { DEMO_ACCOUNTS } from "./mode"
import { loadDemoDb, nextId, persist } from "./store"
import { serializeSession, serializeGrid, serializeGroup, serializeProjectDetail, serializeProjectSummary, serializeSubmission, serializeUser } from "./serialize"
import { parseCsv, parseJson } from "../student-import"
import type { DemoDb, DemoDeliverable, DemoGroup, DemoProject, DemoPromotion, DemoReport, DemoSession, DemoUser } from "./types"

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
  const status = payload.status === "validated" ? "validated" : payload.status === "submitted" ? "submitted" : "draft"

  if (existing) {
    existing.entries = entries
    existing.globalComment = payload.globalComment ?? existing.globalComment
    existing.totalScore = Number(payload.totalScore) || weightedTotal(db, grid.id, entries)
    existing.status = status
    existing.gradedBy = teacher.id
    if (status === "validated") existing.validatedAt = new Date().toISOString()
    persist()
    return existing
  }

  const session: DemoSession = {
    id: nextId(db),
    gridId: grid.id,
    groupId,
    entries,
    globalComment: payload.globalComment ?? "",
    totalScore: Number(payload.totalScore) || weightedTotal(db, grid.id, entries),
    status,
    gradedBy: teacher.id,
    gradedAt: new Date().toISOString(),
    submittedAt: status === "draft" ? undefined : new Date().toISOString(),
    validatedAt: status === "validated" ? new Date().toISOString() : undefined,
  }
  db.sessions.push(session)
  persist()
  return session
}

function buildSummary(db: DemoDb, projectId: number) {
  const grids = db.grids.filter((g) => g.projectId === projectId)
  const groups = db.groups.filter((g) => g.projectId === projectId)

  const groupRows = groups.map((group) => {
    const grades = grids
      .map((grid) => {
        const session = db.sessions.find((s) => s.gridId === grid.id && s.groupId === group.id)
        if (!session) return null
        return {
          id: session.id,
          gridId: grid.id,
          gridName: grid.name,
          totalScore: session.totalScore,
          isValidated: session.status === "validated",
        }
      })
      .filter((g): g is NonNullable<typeof g> => g !== null)

    let weighted = 0
    let totalWeight = 0
    for (const grade of grades) {
      const grid = grids.find((g) => g.id === grade.gridId)
      if (grid) {
        weighted += grade.totalScore * grid.weight
        totalWeight += grid.weight
      }
    }
    return {
      id: group.id,
      name: group.name,
      grades,
      finalGrade: totalWeight > 0 ? Math.round((weighted / totalWeight) * 100) / 100 : 0,
    }
  })

  const allValidated =
    groups.length > 0 &&
    groupRows.every((g) => g.grades.length === grids.length && g.grades.every((gr) => gr.isValidated))

  return {
    gradingGrids: grids.map((g) => ({ id: g.id, name: g.name, type: g.type, weight: g.weight })),
    grids: grids.map((g) => ({ id: g.id, name: g.name, type: g.type, weight: g.weight })),
    groups: groupRows,
    allValidated,
  }
}

function myGrades(db: DemoDb, user: DemoUser) {
  const myGroups = db.groups.filter((g) => g.memberIds.includes(user.id))
  const rows: Array<Record<string, unknown>> = []
  for (const session of db.sessions) {
    if (session.status !== "validated") continue
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
      type: grid.type,
      title: grid.name,
      grade: session.totalScore,
      maxGrade: 20,
      feedback: session.globalComment || null,
      gradedAt: session.validatedAt ?? session.gradedAt,
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
  return rows
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
      const groups = db.groups.filter((g) => g.projectId === projectId)
      if (groups.length === 0) return fail(400, "Créez d’abord des groupes pour planifier les soutenances.")
      const start = new Date(body.startDateTime)
      if (Number.isNaN(start.getTime())) return fail(400, "Date de début invalide.")
      const location = String(body.location ?? "Salle à définir")
      const durationMinutes = Number(body.durationPerGroup) ||
        (body.endDateTime ? Math.max(10, Math.floor((new Date(body.endDateTime).getTime() - start.getTime()) / 60_000 / groups.length)) : 30)

      db.defenses = db.defenses.filter((d) => d.projectId !== projectId)
      groups.forEach((group, i) => {
        const slotStart = new Date(start.getTime() + i * (durationMinutes + 5) * 60_000)
        db.defenses.push({
          id: nextId(db),
          projectId,
          groupId: group.id,
          startTime: slotStart.toISOString(),
          endTime: new Date(slotStart.getTime() + durationMinutes * 60_000).toISOString(),
          orderIndex: i + 1,
          location,
        })
      })
      persist()
      const defenses = db.defenses.filter((d) => d.projectId === projectId).sort((a, b) => a.orderIndex - b.orderIndex)
      return json({ message: "Soutenances planifiées (démo).", defenses }, 201)
    }
    m = /^\/defenses\/projects\/(\d+)\/reorder$/.exec(route)
    if (m && method === "PUT") {
      const owner = requireTeacher(db, init, headers)
      assertOwnsProject(db, owner, Number(m![1]))
      const projectId = Number(m![1])
      const newOrder: Array<{ groupId: number; orderIndex: number }> = body.newOrder ?? []
      for (const item of newOrder) {
        const defense = db.defenses.find((d) => d.projectId === projectId && d.groupId === Number(item.groupId))
        if (defense) defense.orderIndex = Number(item.orderIndex)
      }
      persist()
      const defenses = db.defenses.filter((d) => d.projectId === projectId).sort((a, b) => a.orderIndex - b.orderIndex)
      return json({ defenses })
    }
    m = /^\/defenses\/projects\/(\d+)\/(schedule\/pdf|attendance\/pdf)$/.exec(route)
    if (m && method === "GET") {
      const owner = requireTeacher(db, init, headers)
      assertOwnsProject(db, owner, Number(m![1]))
      return fail(501, "Export PDF désactivé en démo.")
    }

    if (route === "/grading/grids" && method === "POST") {
      assertOwnsProject(db, requireTeacher(db, init, headers), Number(body.projectId))
      const grid = {
        id: nextId(db),
        projectId: Number(body.projectId),
        name: String(body.name ?? "Nouvelle grille"),
        type: (body.type ?? "deliverable") as "deliverable" | "report" | "defense",
        weight: Number(body.weight) || 1,
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
        hasComments: body.hasComments ?? true,
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
        sessions = sessions.filter((s) => myGroups.some((g) => g.id === s.groupId) && s.status === "validated")
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
    if (route === "/grading/grades/validate" && method === "POST") {
      requireTeacher(db, init, headers)
      const projectId = Number(body.projectId)
      const grids = db.grids.filter((g) => g.projectId === projectId)
      const groups = db.groups.filter((g) => g.projectId === projectId)
      for (const grid of grids) {
        for (const group of groups) {
          const session = db.sessions.find((s) => s.gridId === grid.id && s.groupId === group.id)
          if (session && session.status !== "validated") {
            session.status = "validated"
            session.validatedAt = new Date().toISOString()
          }
        }
      }
      persist()
      return json({ success: true })
    }

    m = /^\/reports\/projects\/(\d+)$/.exec(route)
    if (m && method === "GET") {
      const owner = requireTeacher(db, init, headers)
      assertOwnsProject(db, owner, Number(m![1]))
      const reports = db.reports.filter((r) => r.projectId === Number(m![1]))
      return json(reports.map((r) => {
        const group = db.groups.find((g) => g.id === r.groupId)
        return {
          id: r.id,
          projectId: r.projectId,
          groupId: r.groupId,
          group: group ? { id: group.id, name: group.name } : null,
          title: r.title,
          status: r.status,
          submittedAt: r.submittedAt ?? null,
          sections: r.sections,
          updatedAt: r.sections[0]?.updatedAt ?? null,
        }
      }))
    }
    m = /^\/reports\/projects\/(\d+)\/report-config$/.exec(route)
    if (m && method === "DELETE") {
      const owner = requireTeacher(db, init, headers)
      assertOwnsProject(db, owner, Number(m![1]))
      const projectId = Number(m![1])
      db.reportConfigs = db.reportConfigs.filter((c) => c.projectId !== projectId)
      db.reports = db.reports.filter((r) => r.projectId !== projectId)
      persist()
      return ok()
    }
    if (m && (method === "GET" || method === "POST" || method === "PUT")) {
      const projectId = Number(m![1])
      const viewer = requireUser(db, init, headers)
      if (!canAccessProject(db, viewer, projectId)) return fail(403, "Vous n’avez pas accès à ce projet.")
      let config = db.reportConfigs.find((c) => c.projectId === projectId)
      if (!config && method === "GET") {
        return json({ isEnabled: false, format: "markdown", deadline: null, instructions: null, sections: [] })
      }
      if (!config) {
        config = { projectId, isEnabled: false, format: "markdown", deadline: new Date(Date.now() + 21 * 86_400_000).toISOString(), sections: [] }
        db.reportConfigs.push(config)
      }
      if (method === "POST" || method === "PUT") {
        const owner = requireTeacher(db, init, headers)
        assertOwnsProject(db, owner, Number(m![1]))
        if (body.isEnabled !== undefined) config.isEnabled = Boolean(body.isEnabled)
        if (body.format) config.format = body.format
        if (body.deadline !== undefined) config.deadline = body.deadline
        if (body.instructions !== undefined) config.instructions = body.instructions
        if (Array.isArray(body.sections)) {
          config.sections = body.sections.map((s: any, i: number) => ({
            id: Number(s.id) || nextId(db),
            title: String(s.title ?? `Section ${i + 1}`),
            description: s.description ?? "",
            required: Boolean(s.required),
            wordLimit: s.wordLimit ? Number(s.wordLimit) : undefined,
            order: Number(s.order) || i + 1,
          }))
        }
        persist()
      }
      return json(config)
    }
    m = /^\/reports\/section-config\/(\d+)$/.exec(route)
    if (m && method === "DELETE") {
      requireTeacher(db, init, headers)
      const sectionId = Number(m![1])
      const config = db.reportConfigs.find((c) => c.sections.some((sec) => sec.id === sectionId))
      if (!config) return fail(404, "Section introuvable.")
      config.sections = config.sections.filter((sec) => sec.id !== sectionId)
      for (const report of db.reports) {
        if (report.projectId === config.projectId) {
          report.sections = report.sections.filter((sec) => sec.sectionConfigId !== sectionId)
        }
      }
      persist()
      return ok()
    }
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
      return json({
        id: report.id,
        projectId: report.projectId,
        groupId: report.groupId,
        title: report.title,
        status: report.status,
        submittedAt: report.submittedAt ?? null,
        sections: report.sections,
      })
    }
    m = /^\/reports\/groups\/(\d+)\/projects\/(\d+)\/submit$/.exec(route)
    if (m && method === "POST") {
      const student = requireStudent(db, init, headers)
      const group = db.groups.find((g) => g.id === Number(m![1]) && g.projectId === Number(m![2]))
      if (!group?.memberIds.includes(student.id)) return fail(403, "Soumission autorisée uniquement pour votre groupe.")
      const report = findOrCreateReport(db, group)
      if (report.status === "submitted") return fail(409, "Le rapport a déjà été soumis.")
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
      const report = findOrCreateReport(db, group)
      if (report.status === "submitted") return fail(403, "Le rapport a été soumis : il n’est plus modifiable.")
      let section = report.sections.find((s) => s.sectionConfigId === sectionConfigId)
      if (!section) {
        section = { sectionConfigId, content: "", updatedAt: "" }
        report.sections.push(section)
      }
      section.content = String(body.content ?? "")
      section.updatedAt = new Date().toISOString()
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
