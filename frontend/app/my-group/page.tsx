"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Users } from "lucide-react"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { MainLayout } from "@/components/layout/main-layout"
import { PageContainer, PageHeader } from "@/components/layout/page"
import { EmptyState } from "@/components/shared/EmptyState"
import { ErrorState } from "@/components/shared/ErrorState"
import { StudentDefenseBanner } from "@/components/projects/StudentDefenseCard"
import { GroupReportStatus } from "@/components/reports/GroupReportStatus"
import { SectionCard } from "@/components/shared/SectionCard"
import { CardsSkeleton } from "@/components/shared/Skeletons"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { errorMessage } from "@/lib/api"
import { plural } from "@/lib/format"
import { fullName, initials } from "@/lib/people"
import { defensesOf, studentGroupState } from "@/lib/projects"
import { projectPath } from "@/lib/routes"
import { fetchMyProjects, type Project } from "@/services/project.service"

export default function MyGroupPage() {
  return (
    <ProtectedRoute roles={["student"]}>
      <MyGroupPageContent />
    </ProtectedRoute>
  )
}

function MyGroupPageContent() {
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
      setError(errorMessage(err, "Impossible de charger votre groupe."))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const studentId = user?.id ?? 0
  const states = useMemo(() => projects.map((project) => ({ project, ...studentGroupState(project, studentId) })), [projects, studentId])
  const memberships = states.filter((item) => item.group)
  const toJoin = states.find((item) => item.state === "can-join")

  return (
    <MainLayout>
      <PageContainer>
        <PageHeader title="Mon groupe" description="Vos coéquipiers et l’accès à l’espace de travail de votre groupe : livrables et rapport." />

        {loading ? (
          <CardsSkeleton count={1} />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : memberships.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Vous n’êtes dans aucun groupe"
            description={
              toJoin
                ? `Les groupes de « ${toJoin.project.name} » se choisissent librement : rejoignez-en un ou créez le vôtre.`
                : projects.length > 0
                  ? "Votre enseignant constitue les groupes. Ils apparaîtront ici dès que vous serez placé dans l’un d’eux."
                  : "Vos groupes apparaîtront ici dès que votre enseignant aura rendu un projet visible pour votre promotion."
            }
            action={
              <Button asChild>
                <Link href={toJoin ? `${projectPath("/my-projects", toJoin.project.id)}#groupes` : "/my-projects"}>{toJoin ? "Rejoindre ou créer un groupe" : "Voir mes projets"}</Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-6">
            {memberships.map(({ project, group }) => (
              <SectionCard
                key={project.id}
                title={group!.name}
                description={`${project.name} · ${plural(group!.members.length, "membre")}`}
              >
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {group!.members.map((member) => (
                    <li key={member.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="text-xs">{initials(member)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {fullName(member)}
                          {member.id === studentId && <span className="font-normal text-muted-foreground"> (vous)</span>}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 space-y-3">
                  <StudentDefenseBanner defenses={defensesOf(project)} groupId={group!.id} href={projectPath("/my-projects", project.id)} />
                  <GroupReportStatus projectId={project.id} groupId={group!.id} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button asChild>
                    <Link href={projectPath("/my-projects", project.id, "/group")}>Ouvrir l’espace du groupe</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href={projectPath("/my-projects", project.id)}>Consignes, dates et groupes</Link>
                  </Button>
                </div>
              </SectionCard>
            ))}
          </div>
        )}
      </PageContainer>
    </MainLayout>
  )
}
