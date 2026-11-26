"use client"

import { useCallback, useEffect, useState } from "react"
import { ClipboardCheck } from "lucide-react"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { MainLayout } from "@/components/layout/main-layout"
import { PageContainer, PageHeader } from "@/components/layout/page"
import { EmptyState } from "@/components/shared/EmptyState"
import { ErrorState } from "@/components/shared/ErrorState"
import { SectionCard } from "@/components/shared/SectionCard"
import { CardsSkeleton } from "@/components/shared/Skeletons"
import { Badge } from "@/components/ui/badge"
import { apiGet, errorMessage } from "@/lib/api"
import { formatDate, formatDecimal, formatNumber, gridTypeLabel, plural } from "@/lib/format"
import { percentOf, type PublishedGrade, type StudentProjectGrades } from "@/lib/grading"

/** Clé du localStorage où l’on garde la date de la dernière visite : l’accueil s’en sert pour signaler les notes nouvelles. */
const LAST_VISIT_KEY = "lastGradesView"

function readLastVisit(): number {
  try {
    const raw = window.localStorage.getItem(LAST_VISIT_KEY)
    return raw ? new Date(raw).getTime() : 0
  } catch {
    return 0
  }
}

export default function MyGradesPage() {
  return (
    <ProtectedRoute roles={["student"]}>
      <MyGradesPageContent />
    </ProtectedRoute>
  )
}

interface Data {
  grades: PublishedGrade[]
  projects: StudentProjectGrades[]
}

function MyGradesPageContent() {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Lue une seule fois à l’ouverture : on l’avance ensuite, mais les notes nouvelles se jugent par rapport à la visite précédente.
  const [lastVisit] = useState(readLastVisit)

  const load = useCallback(async () => {
    setError(null)
    try {
      const [grades, projects] = await Promise.all([
        apiGet<PublishedGrade[]>("/grading/students/my-grades"),
        apiGet<StudentProjectGrades[]>("/grading/students/my-summary").catch(() => [] as StudentProjectGrades[]),
      ])
      setData({ grades, projects })
      try {
        window.localStorage.setItem(LAST_VISIT_KEY, new Date().toISOString())
      } catch {
        // stockage indisponible : les notes ne seront simplement pas signalées comme nouvelles
      }
    } catch (err) {
      setError(errorMessage(err, "Impossible de charger vos notes. Réessayez dans un instant."))
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const newCount = data ? data.grades.filter((grade) => lastVisit > 0 && new Date(grade.gradedAt).getTime() > lastVisit).length : 0

  return (
    <MainLayout>
      <PageContainer width="narrow">
        <PageHeader
          title="Mes notes"
          description={
            newCount > 0
              ? `${plural(newCount, "nouvelle note publiée", "nouvelles notes publiées")} depuis votre dernière visite.`
              : "Ce que vos enseignants ont publié, critère par critère. Une évaluation « pas encore publiée » n’est pas encore visible."
          }
        />

        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : !data ? (
          <CardsSkeleton count={1} />
        ) : (
          <Sections data={data} lastVisit={lastVisit} />
        )}
      </PageContainer>
    </MainLayout>
  )
}

/** Les projets de l’étudiant, puis les notes publiées d’un projet dont le suivi n’est plus affiché (projet repassé en brouillon). */
function Sections({ data, lastVisit }: { data: Data; lastVisit: number }) {
  const followed = new Set(data.projects.map((project) => project.projectId))
  const orphans = data.grades.filter((grade) => !followed.has(grade.projectId))

  if (data.projects.length === 0 && orphans.length === 0) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        title="Aucune note pour l’instant"
        description="Vos enseignants publient les notes une fois les évaluations corrigées. Elles apparaîtront ici avec le détail par critère et leurs commentaires."
      />
    )
  }

  return (
    <div className="space-y-6">
      {data.projects.map((project) => (
        <ProjectGrades key={project.projectId} project={project} grades={data.grades.filter((grade) => grade.projectId === project.projectId)} lastVisit={lastVisit} />
      ))}
      {orphans.length > 0 && (
        <SectionCard title="Autres notes publiées">
          <div className="space-y-4">
            {orphans.map((grade) => (
              <PublishedEvaluation key={grade.id} grade={grade} isNew={lastVisit > 0 && new Date(grade.gradedAt).getTime() > lastVisit} />
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  )
}

function ProjectGrades({ project, grades, lastVisit }: { project: StudentProjectGrades; grades: PublishedGrade[]; lastVisit: number }) {
  const published = project.evaluations.filter((evaluation) => evaluation.published).length

  return (
    <SectionCard title={project.projectName} description={project.groupName}>
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 rounded-lg bg-muted/60 p-4">
          <div>
            <p className="text-sm text-muted-foreground">{project.complete ? "Note finale du projet" : "Note provisoire du projet"}</p>
            <p className="text-3xl font-semibold tabular-nums">
              {project.finalGrade === null ? "–" : formatNumber(project.finalGrade, 2)}
              <span className="text-lg font-normal text-muted-foreground"> / 20</span>
            </p>
          </div>
          <p className="max-w-sm text-sm text-muted-foreground">
            {project.finalGrade === null
              ? "Aucune évaluation n’est encore publiée pour ce projet."
              : project.complete
                ? "Moyenne de toutes les évaluations, pondérée par la part de chacune."
                : `Calculée sur ${published} évaluation${published > 1 ? "s" : ""} publiée${published > 1 ? "s" : ""} sur ${project.evaluations.length} : elle peut encore changer.`}
          </p>
        </div>

        <div className="space-y-4">
          {project.evaluations.map((evaluation) => {
            const grade = grades.find((item) => item.gridId === evaluation.gridId)
            return grade ? (
              <PublishedEvaluation key={evaluation.gridId} grade={grade} share={evaluation.share} isNew={lastVisit > 0 && new Date(grade.gradedAt).getTime() > lastVisit} />
            ) : (
              <article key={evaluation.gridId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg border border-dashed p-4">
                <div className="min-w-0">
                  <h3 className="text-sm font-medium">{evaluation.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {gridTypeLabel(evaluation.type)}, compte pour {percentOf(evaluation.share)} de la note finale
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">Pas encore publiée</p>
              </article>
            )
          })}
        </div>
      </div>
    </SectionCard>
  )
}

function PublishedEvaluation({ grade, share, isNew }: { grade: PublishedGrade; share?: number; isNew: boolean }) {
  const totalWeight = grade.criteria.reduce((sum, criterion) => sum + criterion.weight, 0)

  return (
    <article className="rounded-lg border">
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b p-4">
        <div className="min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{grade.title}</h3>
            {isNew && <Badge>Nouvelle</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">
            {gridTypeLabel(grade.type)}
            {share !== undefined && `, compte pour ${percentOf(share)} de la note finale`} · publiée le {formatDate(grade.gradedAt)}
          </p>
        </div>
        <p className="text-xl font-semibold tabular-nums">
          {formatNumber(grade.grade, 2)}
          <span className="text-sm font-normal text-muted-foreground"> / {formatNumber(grade.maxGrade, 0)}</span>
        </p>
      </header>

      {grade.criteria.length > 0 && (
        <ul className="divide-y px-4">
          {grade.criteria.map((criterion) => (
            <li key={criterion.name} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-3">
              <div className="min-w-0 flex-[1_1_14rem]">
                <p className="text-sm font-medium">{criterion.name}</p>
                <p className="text-xs text-muted-foreground">
                  {totalWeight > 0 ? `Compte pour ${percentOf(criterion.weight / totalWeight)} de la note de l’évaluation` : `Coefficient ${formatDecimal(criterion.weight)}`}
                </p>
                {criterion.comments && <p className="mt-1.5 whitespace-pre-line text-sm text-muted-foreground">{criterion.comments}</p>}
              </div>
              <p className="text-sm font-semibold tabular-nums">
                {formatNumber(criterion.score, Number.isInteger(criterion.score) ? 0 : 1)}
                <span className="font-normal text-muted-foreground"> / {formatNumber(criterion.maxScore, 0)}</span>
              </p>
            </li>
          ))}
        </ul>
      )}

      {grade.feedback && (
        <div className="border-t p-4">
          <h4 className="text-sm font-medium">Appréciation générale</h4>
          <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{grade.feedback}</p>
        </div>
      )}
    </article>
  )
}
