"use client"

import Link from "next/link"
import { useCallback, useMemo } from "react"
import { CheckCircle2, FolderOpen } from "lucide-react"
import { PageContainer, PageHeader } from "@/components/layout/page"
import { DueBadge } from "@/components/shared/DueBadge"
import { EmptyState } from "@/components/shared/EmptyState"
import { ErrorState } from "@/components/shared/ErrorState"
import { SectionCard } from "@/components/shared/SectionCard"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { DashboardSkeleton, QuietEmpty, RowLink, useOverview } from "@/components/dashboard/parts"
import { loadStudentOverview, type StudentOverview, type StudentTask } from "@/lib/dashboard"
import { formatDate, formatDateFull, formatDateTime, formatNumber, gridTypeLabel } from "@/lib/format"

const MAX_NEXT_TASKS = 4
const MAX_GRADES = 3

const TASK_ACTIONS: Record<StudentTask["kind"], string> = {
  deliverable: "Rendre le livrable",
  report: "Rédiger le rapport",
  group: "Choisir mon groupe",
}

/** Date de la dernière visite de « Mes notes » : les notes publiées depuis sont signalées comme nouvelles. */
function lastGradesVisit(): number {
  try {
    const raw = window.localStorage.getItem("lastGradesView")
    return raw ? new Date(raw).getTime() : 0
  } catch {
    return 0
  }
}

export function StudentDashboard({ firstName, studentId }: { firstName: string; studentId: number }) {
  const load = useCallback(() => loadStudentOverview(studentId), [studentId])
  const { data, loading, error, reload } = useOverview(load, "Impossible de charger votre tableau de bord.")

  return (
    <PageContainer>
      <PageHeader title={`Bonjour ${firstName}`} description={formatDateFull(new Date())} />
      {loading ? (
        <DashboardSkeleton />
      ) : error || !data ? (
        <ErrorState message={error ?? undefined} onRetry={reload} />
      ) : data.projectCount === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="Aucun projet pour l’instant"
          description="Vos projets apparaîtront ici dès que votre enseignant les aura publiés pour votre promotion."
        />
      ) : (
        <Overview data={data} />
      )}
    </PageContainer>
  )
}

function Overview({ data }: { data: StudentOverview }) {
  const [next, ...others] = data.tasks
  const lastVisit = useMemo(lastGradesVisit, [])

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
      <div className="min-w-0 space-y-6 lg:col-span-2">
        {next ? (
          <Card className="gap-4 border-primary/40">
            <CardHeader>
              <CardDescription>{next.kind === "deliverable" ? "Prochain rendu" : "Prochaine étape"}</CardDescription>
              <h2 data-slot="card-title" className="text-xl font-semibold leading-tight">
                {next.title}
              </h2>
              <p className="text-sm text-muted-foreground">{next.projectName}</p>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {next.dueAt ? (
                  <>
                    <DueBadge date={next.dueAt} />
                    <span className="text-muted-foreground">{formatDateTime(next.dueAt)}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">Pas d’échéance fixée</span>
                )}
              </div>
              <Button asChild>
                <Link href={next.href}>{TASK_ACTIONS[next.kind]}</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="gap-2">
            <CardHeader>
              <h2 data-slot="card-title" className="flex items-center gap-2 text-base font-semibold leading-none">
                <CheckCircle2 aria-hidden="true" className="h-5 w-5 text-primary" />
                Vous êtes à jour
              </h2>
              <CardDescription>Aucun rendu en attente pour le moment. Vos notes et vos prochains rendus s’afficheront ici.</CardDescription>
            </CardHeader>
          </Card>
        )}

        {others.length > 0 && (
          <SectionCard title="Ensuite" action={{ href: "/my-deliverables", label: "Mes livrables" }}>
            <ul className="divide-y">
              {others.slice(0, MAX_NEXT_TASKS).map((task) => (
                <RowLink
                  key={task.key}
                  href={task.href}
                  aside={
                    task.dueAt && (
                      <>
                        <span className="text-xs text-muted-foreground">{formatDate(task.dueAt)}</span>
                        <DueBadge date={task.dueAt} />
                      </>
                    )
                  }
                >
                  <span className="block text-sm font-medium">{task.title}</span>
                  <span className="block text-xs text-muted-foreground">{task.projectName}</span>
                </RowLink>
              ))}
            </ul>
          </SectionCard>
        )}
      </div>

      <div className="min-w-0 space-y-6">
        <SectionCard title="Dernières notes" action={{ href: "/my-grades", label: "Toutes mes notes" }}>
          {data.grades.length === 0 ? (
            <QuietEmpty>Aucune note publiée pour l’instant. Vous la verrez ici dès que votre enseignant l’aura publiée.</QuietEmpty>
          ) : (
            <ul className="divide-y">
              {data.grades.slice(0, MAX_GRADES).map((grade) => (
                <RowLink
                  key={grade.id}
                  href="/my-grades"
                  aside={
                    <>
                      {new Date(grade.gradedAt).getTime() > lastVisit && <Badge>Nouvelle</Badge>}
                      <span className="text-sm font-semibold tabular-nums">
                        {formatNumber(grade.grade)} / {formatNumber(grade.maxGrade, 0)}
                      </span>
                    </>
                  }
                >
                  <span className="block text-sm font-medium">{grade.title}</span>
                  <span className="block text-xs text-muted-foreground">
                    {grade.projectName} · {gridTypeLabel(grade.type)} · {formatDate(grade.gradedAt)}
                  </span>
                </RowLink>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Soutenance">
          {data.defense ? (
            <Link
              href={data.defense.href}
              className="-m-2 block rounded-md p-2 outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring"
            >
              <span className="block text-sm font-medium">{formatDateTime(data.defense.startTime)}</span>
              <span className="block text-xs text-muted-foreground">
                {data.defense.groupName} · {data.defense.projectName}
                {data.defense.location ? ` · ${data.defense.location}` : ""}
              </span>
            </Link>
          ) : (
            <QuietEmpty>Aucune soutenance planifiée pour votre groupe.</QuietEmpty>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
