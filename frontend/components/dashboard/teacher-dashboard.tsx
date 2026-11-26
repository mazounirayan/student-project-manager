"use client"

import Link from "next/link"
import { FolderOpen } from "lucide-react"
import { PageContainer, PageHeader } from "@/components/layout/page"
import { DueBadge } from "@/components/shared/DueBadge"
import { EmptyState } from "@/components/shared/EmptyState"
import { ErrorState } from "@/components/shared/ErrorState"
import { SectionCard } from "@/components/shared/SectionCard"
import { StatTile } from "@/components/shared/StatTile"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DashboardSkeleton, QuietEmpty, RowLink, useOverview } from "@/components/dashboard/parts"
import { loadTeacherOverview, type TeacherOverview } from "@/lib/dashboard"
import { formatDate, formatDateFull, formatDayMonth, formatDateTime, gridTypeLabel, plural } from "@/lib/format"
import { projectPath } from "@/lib/routes"

const MAX_DEADLINES = 5
const MAX_PROJECTS = 4

export function TeacherDashboard({ firstName }: { firstName: string }) {
  const { data, loading, error, reload } = useOverview(loadTeacherOverview, "Impossible de charger votre tableau de bord.")

  return (
    <PageContainer>
      <PageHeader title={`Bonjour ${firstName}`} description={formatDateFull(new Date())} />
      {loading ? (
        <DashboardSkeleton />
      ) : error || !data ? (
        <ErrorState message={error ?? undefined} onRetry={reload} />
      ) : data.projects.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="Aucun projet pour l’instant"
          description="Créez une promotion avec ses étudiants, puis un projet : les rendus à noter et les échéances apparaîtront ici."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild>
                <Link href="/promotions">Créer une promotion</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/projects">Créer un projet</Link>
              </Button>
            </div>
          }
        />
      ) : (
        <Overview data={data} />
      )}
    </PageContainer>
  )
}

function Overview({ data }: { data: TeacherOverview }) {
  const nextDefense = data.defensePlans[0]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="À noter" value={data.toGradeTotal} hint="travaux, tous projets confondus" emphasis={data.toGradeTotal > 0} />
        <StatTile label="À publier" value={data.toPublishTotal} hint="notes saisies, invisibles des étudiants" emphasis={data.toPublishTotal > 0} />
        <StatTile label="Échéances sous 7 jours" value={data.deadlinesThisWeek} hint="livrables et rapports" />
        <StatTile
          label="Prochaine soutenance"
          value={nextDefense ? formatDayMonth(nextDefense.firstStart) : "–"}
          hint={nextDefense ? nextDefense.projectName : "Aucune de planifiée"}
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <SectionCard
            title="À traiter"
            description="Travaux prêts à être notés et notes à publier."
            action={{ href: "/grading", label: "Évaluations" }}
          >
            {data.gradingTasks.length === 0 ? (
              <QuietEmpty done>Rien à noter pour le moment. Les nouveaux rendus apparaîtront ici.</QuietEmpty>
            ) : (
              <ul className="divide-y">
                {data.gradingTasks.map((task) => (
                  <RowLink
                    key={task.key}
                    href={`/grading?project=${task.projectId}`}
                    aside={
                      <>
                        {task.toGrade > 0 && <Badge>{task.toGrade} à noter</Badge>}
                        {task.toPublish > 0 && <Badge variant="secondary">{task.toPublish} à publier</Badge>}
                      </>
                    }
                  >
                    <span className="block text-sm font-medium">{task.gridName}</span>
                    <span className="block text-xs text-muted-foreground">
                      {task.projectName} · {gridTypeLabel(task.type)}
                    </span>
                  </RowLink>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Prochaines échéances" action={{ href: "/deliverables", label: "Livrables" }}>
            {data.deadlines.length === 0 ? (
              <QuietEmpty>Aucune échéance à venir. Ajoutez un livrable depuis la page d’un projet.</QuietEmpty>
            ) : (
              <ul className="divide-y">
                {data.deadlines.slice(0, MAX_DEADLINES).map((deadline) => (
                  <RowLink
                    key={deadline.key}
                    href={projectPath("/projects", deadline.projectId)}
                    aside={
                      <>
                        <span className="text-xs text-muted-foreground">{formatDate(deadline.date)}</span>
                        <DueBadge date={deadline.date} />
                      </>
                    }
                  >
                    <span className="block text-sm font-medium">{deadline.title}</span>
                    <span className="block text-xs text-muted-foreground">
                      {deadline.projectName} · Rendu par {plural(deadline.received, "groupe")} sur {deadline.expected}
                    </span>
                  </RowLink>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <div className="min-w-0 space-y-6">
          <SectionCard title="Soutenances à venir">
            {data.defensePlans.length === 0 ? (
              <QuietEmpty>Aucune soutenance planifiée. Le planning se prépare depuis la page d’un projet.</QuietEmpty>
            ) : (
              <ul className="divide-y">
                {data.defensePlans.map((plan) => (
                  <RowLink key={plan.projectId} href={`${projectPath("/projects", plan.projectId)}#defenses`}>
                    <span className="block text-sm font-medium">{plan.projectName}</span>
                    <span className="block text-xs text-muted-foreground">
                      {formatDateTime(plan.firstStart)}
                      {plan.location ? ` · ${plan.location}` : ""}
                    </span>
                    <span className="block text-xs text-muted-foreground">{plural(plan.upcoming, "passage", "passages")} à venir</span>
                  </RowLink>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Mes projets" action={{ href: "/projects", label: "Tout voir" }}>
            <ul className="divide-y">
              {data.projects.slice(0, MAX_PROJECTS).map((project) => (
                <RowLink
                  key={project.id}
                  href={projectPath("/projects", project.id)}
                  aside={<Badge variant={project.status === "visible" ? "secondary" : "outline"}>{project.status === "visible" ? "Visible" : "Brouillon"}</Badge>}
                >
                  <span className="block text-sm font-medium">{project.name}</span>
                  <span className="block text-xs text-muted-foreground">{plural(project.groups.length, "groupe", "groupes")}</span>
                </RowLink>
              ))}
            </ul>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
