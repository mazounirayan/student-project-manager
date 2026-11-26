"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { CalendarClock, FolderOpen, Users } from "lucide-react"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { MainLayout } from "@/components/layout/main-layout"
import { PageContainer, PageHeader } from "@/components/layout/page"
import { DueBadge } from "@/components/shared/DueBadge"
import { EmptyState } from "@/components/shared/EmptyState"
import { ErrorState } from "@/components/shared/ErrorState"
import { CardsSkeleton } from "@/components/shared/Skeletons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { useAuth } from "@/contexts/auth-context"
import { errorMessage } from "@/lib/api"
import { formatDateTime, formatDayMonth, plural } from "@/lib/format"
import { nextDeliverable, studentGroupState } from "@/lib/projects"
import { projectPath } from "@/lib/routes"
import { fetchMyProjects, type Project } from "@/services/project.service"

export default function MyProjectsPage() {
  return (
    <ProtectedRoute roles={["student"]}>
      <MyProjectsPageContent />
    </ProtectedRoute>
  )
}

function MyProjectsPageContent() {
  const { user } = useAuth()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchMyProjects()
      setProjects(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(errorMessage(err, "Impossible de charger vos projets."))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <MainLayout>
      <PageContainer>
        <PageHeader title="Mes projets" description="Les consignes, vos dates à retenir et votre groupe pour chaque projet." />

        {loading ? (
          <CardsSkeleton count={2} />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : projects.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="Aucun projet pour l’instant"
            description="Vos projets apparaîtront ici dès que votre enseignant en aura rendu un visible pour votre promotion."
          />
        ) : (
          <ul className="grid gap-4">
            {projects.map((project) => (
              <li key={project.id}>
                <ProjectCard project={project} studentId={user?.id ?? 0} />
              </li>
            ))}
          </ul>
        )}
      </PageContainer>
    </MainLayout>
  )
}

function ProjectCard({ project, studentId }: { project: Project; studentId: number }) {
  const { group, state } = studentGroupState(project, studentId)
  const deliverable = nextDeliverable(project)
  const detail = projectPath("/my-projects", project.id)

  return (
    <Card className="gap-4">
      <CardHeader>
        <h2 data-slot="card-title" className="leading-snug font-semibold">
          <Link href={detail} className="rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            {project.name}
          </Link>
        </h2>
        <CardDescription>{project.teacherName ? `Enseignant : ${project.teacherName}` : "Projet de votre promotion"}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {project.description && <p className="line-clamp-2 text-sm text-muted-foreground">{project.description}</p>}

        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div className="flex items-start gap-2">
            <Users aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="space-y-1">
              <dt className="sr-only">Votre groupe</dt>
              <dd>
                {group ? (
                  <>
                    <Badge variant="secondary">{group.name}</Badge>{" "}
                    <span className="text-muted-foreground">{plural(group.members.length, "membre")}</span>
                  </>
                ) : state === "can-join" ? (
                  <span className="font-medium">Vous n’avez pas encore de groupe</span>
                ) : state === "waiting" ? (
                  <span className="text-muted-foreground">Votre enseignant constitue les groupes</span>
                ) : (
                  <span className="font-medium">Vous n’avez pas de groupe : contactez votre enseignant</span>
                )}
              </dd>
              {!group && state === "can-join" && project.groupFormationDeadline && (
                <dd className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  Jusqu’au {formatDateTime(project.groupFormationDeadline)}
                  <DueBadge date={project.groupFormationDeadline} />
                </dd>
              )}
            </div>
          </div>

          <div className="flex items-start gap-2">
            <CalendarClock aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="space-y-1">
              <dt className="sr-only">Prochaine échéance</dt>
              <dd>
                {deliverable ? (
                  <>
                    <span className="font-medium">{deliverable.name}</span>
                    <span className="text-muted-foreground"> · {formatDayMonth(deliverable.deadline)}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">Aucune échéance à venir</span>
                )}
              </dd>
              {deliverable && (
                <dd>
                  <DueBadge date={deliverable.deadline} />
                </dd>
              )}
            </div>
          </div>
        </dl>

        <div className="flex flex-wrap gap-2">
          {state === "can-join" ? (
            <Button asChild>
              <Link href={`${detail}#groupes`}>Rejoindre ou créer un groupe</Link>
            </Button>
          ) : (
            <Button asChild>
              <Link href={group ? projectPath("/my-projects", project.id, "/group") : detail}>{group ? "Ouvrir l’espace du groupe" : "Voir le projet"}</Link>
            </Button>
          )}
          {(group || state === "can-join") && (
            <Button asChild variant="outline">
              <Link href={detail}>Consignes et dates</Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
