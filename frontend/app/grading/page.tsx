"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ClipboardCheck, Download, FolderOpen, Send } from "lucide-react"
import { toast } from "sonner"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { GradeStateBadge } from "@/components/grading/GradeStateBadge"
import { MainLayout } from "@/components/layout/main-layout"
import { PageContainer, PageHeader } from "@/components/layout/page"
import { ProjectStatusBadge } from "@/components/projects/project-status-badge"
import { EmptyState } from "@/components/shared/EmptyState"
import { ErrorState } from "@/components/shared/ErrorState"
import { SectionCard } from "@/components/shared/SectionCard"
import { CardsSkeleton } from "@/components/shared/Skeletons"
import { StatTile } from "@/components/shared/StatTile"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { apiGet, downloadFile, errorMessage } from "@/lib/api"
import { gradingHref } from "@/lib/deliverables"
import { formatNumber, gridTypeLabel, plural } from "@/lib/format"
import {
  NOT_READY_LABELS,
  defenseGradingHref,
  gridSetupHref,
  isReadyToGrade,
  percentOf,
  progressOf,
  publishGrades,
  summaryState,
  type GradableWork,
  type GradeState,
  type ProjectSummary,
  type SummaryGrid,
  type SummaryGroup,
} from "@/lib/grading"
import { reportHash } from "@/lib/reports"
import { projectPath } from "@/lib/routes"
import { cn } from "@/lib/utils"
import { fetchMyProjects, getProjectById, type Project } from "@/services/project.service"

export default function GradingSummaryPage() {
  return (
    <ProtectedRoute roles={["teacher"]}>
      <GradingSummaryPageContent />
    </ProtectedRoute>
  )
}

type Summaries = Record<number, ProjectSummary | null>
/** Ce que chaque projet a reçu (rendus, rapports, soutenances) : il dit quels travaux sont prêts à être notés. */
type Works = Record<number, GradableWork | null>

/** Projet à ouvrir en premier : celui de l’adresse (?project=), sinon le premier qui demande encore du travail. */
function firstProject(projects: Project[], summaries: Summaries, works: Works): number | null {
  const wanted = Number(new URLSearchParams(window.location.search).get("project"))
  if (projects.some((project) => project.id === wanted)) return wanted
  const busy = projects.find((project) => {
    const summary = summaries[project.id]
    if (!summary) return false
    const progress = progressOf(summary, works[project.id])
    return progress.todo + progress.validated > 0
  })
  return (busy ?? projects[0])?.id ?? null
}

function GradingSummaryPageContent() {
  const [projects, setProjects] = useState<Project[]>([])
  const [summaries, setSummaries] = useState<Summaries>({})
  const [works, setWorks] = useState<Works>({})
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const loadSummary = useCallback(async (projectId: number) => {
    try {
      return await apiGet<ProjectSummary>(`/grading/projects/${projectId}/summary`)
    } catch {
      return null
    }
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await fetchMyProjects()
      const loaded = await Promise.all(
        list.map(async (project) => {
          const [summary, work] = await Promise.all([loadSummary(project.id), getProjectById(project.id).catch(() => null)])
          return { id: project.id, summary, work: work as GradableWork | null }
        }),
      )
      const summariesById = Object.fromEntries(loaded.map((item) => [item.id, item.summary]))
      const worksById = Object.fromEntries(loaded.map((item) => [item.id, item.work]))
      setProjects(list)
      setSummaries(summariesById)
      setWorks(worksById)
      setSelectedId((current) => current ?? firstProject(list, summariesById, worksById))
    } catch (err) {
      setError(errorMessage(err, "Impossible de charger vos projets."))
    } finally {
      setLoading(false)
    }
  }, [loadSummary])

  useEffect(() => {
    void load()
  }, [load])

  const refresh = useCallback(
    async (projectId: number) => {
      const summary = await loadSummary(projectId)
      setSummaries((current) => ({ ...current, [projectId]: summary }))
    },
    [loadSummary],
  )

  const select = (projectId: number) => {
    setSelectedId(projectId)
    window.history.replaceState(null, "", `?project=${projectId}`)
  }

  const totals = useMemo(() => {
    const sum = { todo: 0, toPublish: 0, published: 0, total: 0 }
    for (const [id, summary] of Object.entries(summaries)) {
      if (!summary) continue
      const progress = progressOf(summary, works[Number(id)])
      sum.todo += progress.todo
      sum.toPublish += progress.validated
      sum.published += progress.published
      sum.total += progress.total
    }
    return sum
  }, [summaries, works])

  const project = projects.find((item) => item.id === selectedId)
  const summary = selectedId === null ? null : summaries[selectedId]

  async function publish(summary: ProjectSummary, group?: SummaryGroup) {
    const count = group
      ? summary.gradingGrids.filter((grid) => summaryState(group.grades.find((grade) => grade.gridId === grid.id)) === "validated").length
      : progressOf(summary).validated
    const key = group ? `group-${group.id}` : "project"
    setBusy(key)
    try {
      const published = await publishGrades(summary.project.id, count, {
        groupId: group?.id,
        label: group ? `les notes validées de ${group.name}` : count === 1 ? "la note validée du projet" : `les ${count} notes validées du projet`,
      })
      if (published === null) return
      toast.success(`${plural(published, "note publiée", "notes publiées")}.`, {
        description: "Les étudiants concernés la retrouvent dans « Mes notes ».",
      })
      await refresh(summary.project.id)
    } catch (err) {
      toast.error("Les notes n’ont pas été publiées.", { description: errorMessage(err, "Réessayez dans un instant.") })
    } finally {
      setBusy(null)
    }
  }

  async function exportCsv(projectId: number) {
    try {
      await downloadFile(`/grading/projects/${projectId}/export`, `notes-projet-${projectId}.csv`)
    } catch (err) {
      toast.error("L’export n’a pas été téléchargé.", { description: errorMessage(err, "Réessayez dans un instant.") })
    }
  }

  return (
    <MainLayout>
      <PageContainer>
        <PageHeader title="Évaluations" description="Ce qu’il reste à noter et à publier, projet par projet. Les notes se saisissent dans la page de chaque projet." />

        {loading ? (
          <CardsSkeleton count={2} />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : projects.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="Aucun projet pour le moment"
            description="Créez un projet, ses groupes et ses grilles de notation : le suivi des notes apparaîtra ici."
            action={
              <Button asChild>
                <Link href="/projects">Voir les projets</Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-3 gap-3">
              <StatTile label="À noter" value={totals.todo} hint="travaux prêts, sans note validée" emphasis={totals.todo > 0} />
              <StatTile label="À publier" value={totals.toPublish} hint="validées, invisibles des étudiants" emphasis={totals.toPublish > 0} />
              <StatTile label="Publiées" value={`${totals.published}/${totals.total}`} hint="visibles des étudiants" />
            </div>

            <SectionCard title="Projets" description="Choisissez un projet pour voir où en est chaque groupe.">
              <ul className="divide-y">
                {projects.map((item) => {
                  const itemSummary = summaries[item.id]
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => select(item.id)}
                        aria-current={item.id === selectedId ? "true" : undefined}
                        className={cn(
                          "-mx-2 flex w-[calc(100%+1rem)] flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-md px-2 py-2.5 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring",
                          item.id === selectedId && "bg-muted",
                        )}
                      >
                        <span className="min-w-0 flex-[1_1_14rem]">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium">{item.name}</span>
                            <ProjectStatusBadge status={item.status} />
                          </span>
                          <span className="block text-xs text-muted-foreground">{itemSummary ? describeProgress(itemSummary) : "Suivi indisponible"}</span>
                        </span>
                        {itemSummary && <ProgressBadges summary={itemSummary} work={works[item.id]} />}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </SectionCard>

            {project && (
              <ProjectDetail
                project={project}
                summary={summary ?? null}
                work={works[project.id] ?? null}
                busy={busy}
                onPublish={publish}
                onExport={() => exportCsv(project.id)}
                onRetry={() => refresh(project.id)}
              />
            )}
          </div>
        )}
      </PageContainer>
    </MainLayout>
  )
}

function describeProgress(summary: ProjectSummary): string {
  if (summary.gradingGrids.length === 0) return "Aucune grille de notation"
  if (summary.groups.length === 0) return "Aucun groupe à noter"
  const progress = progressOf(summary)
  return `${progress.published} note${progress.published > 1 ? "s" : ""} publiée${progress.published > 1 ? "s" : ""} sur ${progress.total}`
}

function ProgressBadges({ summary, work }: { summary: ProjectSummary; work: GradableWork | null | undefined }) {
  if (summary.gradingGrids.length === 0 || summary.groups.length === 0) return null
  const progress = progressOf(summary, work)
  const todo = progress.todo
  if (todo + progress.validated === 0) {
    return <Badge variant="outline">{progress.published === progress.total ? "Tout est publié" : "Rien à noter pour l’instant"}</Badge>
  }
  return (
    <span className="flex flex-wrap items-center gap-2">
      {todo > 0 && <Badge>{todo} à noter</Badge>}
      {progress.validated > 0 && <Badge variant="secondary">{progress.validated} à publier</Badge>}
    </span>
  )
}

interface ProjectDetailProps {
  project: Project
  summary: ProjectSummary | null
  work: GradableWork | null
  busy: string | null
  onPublish: (summary: ProjectSummary, group?: SummaryGroup) => void
  onExport: () => void
  onRetry: () => void
}

function ProjectDetail({ project, summary, work, busy, onPublish, onExport, onRetry }: ProjectDetailProps) {
  if (!summary) return <ErrorState message="Le suivi des notes de ce projet n’a pas pu être chargé." onRetry={onRetry} />

  const { gradingGrids: grids, groups } = summary
  const progress = progressOf(summary, work)

  return (
    <section aria-labelledby="project-detail-title" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 space-y-1">
          <h2 id="project-detail-title" className="text-lg font-semibold">
            {project.name}
          </h2>
          <p className="text-sm text-muted-foreground">
            {plural(groups.length, "groupe")}, {plural(grids.length, "grille")}. La note finale ne compte que les notes validées, pondérées par le poids de chaque grille.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link href={projectPath("/projects", project.id)}>Ouvrir le projet</Link>
          </Button>
          {groups.length > 0 && grids.length > 0 && (
            <Button variant="outline" onClick={onExport}>
              <Download aria-hidden="true" />
              Exporter (CSV)
            </Button>
          )}
          {progress.total > 0 && (
            <Button onClick={() => onPublish(summary)} disabled={progress.validated === 0 || busy !== null}>
              <Send aria-hidden="true" />
              {progress.validated > 0 ? `Publier les notes validées (${progress.validated})` : "Aucune note validée à publier"}
            </Button>
          )}
        </div>
      </div>

      {grids.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="Aucune grille de notation pour ce projet"
          description="Créez une grille par livrable, une pour le rapport et une pour la soutenance : vous pourrez ensuite noter chaque groupe et suivre ici ce qui reste à faire."
          action={
            <Button asChild>
              <Link href={gridSetupHref(project.id)}>Créer une grille</Link>
            </Button>
          }
        />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="Aucun groupe à noter"
          description="Les groupes se constituent dans la page du projet, onglet Groupes."
          action={
            <Button asChild variant="outline">
              <Link href={`${projectPath("/projects", project.id)}#groups`}>Ouvrir les groupes</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border bg-card text-card-foreground shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 z-10 min-w-32 bg-card">Groupe</TableHead>
                  {grids.map((grid) => (
                    <TableHead key={grid.id} className="min-w-44 whitespace-normal align-top">
                      <span className="block font-medium text-foreground">{grid.name}</span>
                      <span className="block text-xs font-normal text-muted-foreground">
                        {gridTypeLabel(grid.type)}, {percentOf(weightShare(grids, grid))} de la note finale
                      </span>
                    </TableHead>
                  ))}
                  <TableHead className="min-w-28 text-right align-top">Note finale</TableHead>
                  <TableHead className="min-w-36 text-right align-top">Publication</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((group) => {
                  const toPublish = grids.filter((grid) => summaryState(group.grades.find((grade) => grade.gridId === grid.id)) === "validated").length
                  const published = grids.filter((grid) => summaryState(group.grades.find((grade) => grade.gridId === grid.id)) === "published").length
                  const validated = group.grades.filter((grade) => grade.isValidated).length
                  return (
                    <TableRow key={group.id}>
                      <TableCell className="sticky left-0 z-10 bg-card font-medium">{group.name}</TableCell>
                      {grids.map((grid) => {
                        const grade = group.grades.find((item) => item.gridId === grid.id)
                        const state = summaryState(grade)
                        return (
                          <TableCell key={grid.id}>
                            <div className="flex flex-col items-start gap-1">
                              {grade ? (
                                <span className="flex flex-wrap items-center gap-2">
                                  <span className="tabular-nums">{formatNumber(grade.totalScore, 2)} / 20</span>
                                  <GradeStateBadge state={state} />
                                </span>
                              ) : (
                                work && !isReadyToGrade(work, grid, group.id) && <span className="text-xs text-muted-foreground">{NOT_READY_LABELS[grid.type]}</span>
                              )}
                              <Link
                                href={gradeLink(project.id, grid, group.id)}
                                className={cn(
                                  "rounded-sm text-xs font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                                  state === "none" && "text-sm",
                                )}
                              >
                                {ACTION_LABELS[state]}
                                <span className="sr-only">
                                  {" "}
                                  {grid.name} de {group.name}
                                </span>
                              </Link>
                            </div>
                          </TableCell>
                        )
                      })}
                      <TableCell className="text-right">
                        {group.finalGrade === null ? (
                          <span className="text-muted-foreground">–</span>
                        ) : (
                          <>
                            <span className="font-semibold tabular-nums">{formatNumber(group.finalGrade, 2)} / 20</span>
                            {validated < grids.length && <span className="block text-xs text-muted-foreground">provisoire</span>}
                          </>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {toPublish > 0 ? (
                          <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => onPublish(summary, group)}>
                            Publier {plural(toPublish, "note")}
                            <span className="sr-only"> de {group.name}</span>
                          </Button>
                        ) : published > 0 ? (
                          <span className="text-sm text-muted-foreground">{published === grids.length ? "Tout est publié" : `${plural(published, "note publiée", "notes publiées")}`}</span>
                        ) : (
                          <span className="text-muted-foreground">–</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">
            Brouillon : visible de vous seule. Validée : figée, pas encore visible des étudiants. Publiée : visible des étudiants du groupe.{" "}
            <Link href={gridSetupHref(project.id)} className="text-primary hover:underline">
              Modifier les grilles et leur pondération
            </Link>
          </p>
        </>
      )}
    </section>
  )
}

const ACTION_LABELS: Record<GradeState, string> = { none: "Saisir la note", draft: "Continuer", validated: "Voir la note", published: "Voir la note" }

const weightShare = (grids: SummaryGrid[], grid: SummaryGrid) => {
  const total = grids.reduce((sum, item) => sum + item.weight, 0)
  return total > 0 ? grid.weight / total : 1 / grids.length
}

/** Où l’on saisit cette note : le livrable, le rapport ou la soutenance du groupe, dans la page du projet. */
function gradeLink(projectId: number, grid: SummaryGrid, groupId: number): string {
  switch (grid.type) {
    case "deliverable":
      return grid.deliverableId ? gradingHref(projectId, grid.deliverableId, groupId) : `${projectPath("/projects", projectId)}#deliverables`
    case "report":
      return `${projectPath("/projects", projectId)}${reportHash(groupId)}`
    case "defense":
      return defenseGradingHref(projectId, groupId)
  }
}
