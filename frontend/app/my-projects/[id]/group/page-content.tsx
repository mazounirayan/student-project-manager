"use client"

import { projectPath, useRouteProjectId } from "@/lib/routes"
import { fullName, initials } from "@/lib/people"
import Link from "next/link"
import { MainLayout } from "@/components/layout/main-layout"
import { PageContainer, PageHeader } from "@/components/layout/page"
import { SectionCard } from "@/components/shared/SectionCard"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Users, FileText, ArrowLeft } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { errorMessage } from "@/lib/api"
import { getProjectById, type Project } from "@/services/project.service"
import { StudentDeliverableCard } from "@/components/deliverables/StudentDeliverableCard"
import { StudentReportView } from "@/components/reports/StudentReportView"
import { ErrorState } from "@/components/shared/ErrorState"
import { EmptyState } from "@/components/shared/EmptyState"
import { DetailSkeleton } from "@/components/shared/Skeletons"
import { QuietEmpty } from "@/components/dashboard/parts"
import type { Deliverable } from "@/lib/deliverables"
import { studentGroupState, type ProjectGroup } from "@/lib/projects"

interface GroupDetailsPageProps {
  params: { id: string }
}

export function GroupDetailsPageContent({ params }: GroupDetailsPageProps) {
  const projectId = useRouteProjectId(params.id)
  const { user } = useAuth()
  const studentId = user?.id
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState("deliverables")

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      setError(null)
      try {
        setProject(await getProjectById(projectId))
      } catch (err) {
        setError(errorMessage(err, "Impossible de charger ce projet."))
      } finally {
        setLoading(false)
      }
    },
    [projectId],
  )

  useEffect(() => {
    load()
  }, [load])

  // #rapport ouvre directement l’onglet du rapport (lien « Rédiger le rapport » de l’accueil et de Mon groupe).
  useEffect(() => {
    if (window.location.hash === "#rapport") setTab("reports")
  }, [])

  const changeTab = (value: string) => {
    setTab(value)
    window.history.replaceState(null, "", value === "reports" ? "#rapport" : window.location.pathname + window.location.search)
  }

  if (loading || studentId === undefined) {
    return (
      <MainLayout>
        <PageContainer>
          <DetailSkeleton />
        </PageContainer>
      </MainLayout>
    )
  }

  if (error || !project) {
    return (
      <MainLayout>
        <PageContainer>
          <BackToProject projectId={projectId} />
          <ErrorState message={error ?? "Projet introuvable."} onRetry={() => load()} />
        </PageContainer>
      </MainLayout>
    )
  }

  const { group } = studentGroupState(project, studentId)
  const deliverables = (project.deliverables ?? []) as Deliverable[]

  return (
    <MainLayout>
      <PageContainer>
        <BackToProject projectId={projectId} />
        <PageHeader
          title={project.name}
          description={group ? `Espace de ${group.name} : livrables et rapport` : "Espace de votre groupe"}
          actions={
            <Button asChild variant="outline">
              <Link href={projectPath("/my-projects", projectId)}>Consignes, dates et groupes</Link>
            </Button>
          }
        />

        {!group ? (
          <EmptyState
            icon={Users}
            title="Vous n’êtes pas dans un groupe pour ce projet"
            description="Les livrables et le rapport se rendent au nom d’un groupe. Retrouvez sur la page du projet les groupes existants et ce qu’il vous reste à faire."
            action={
              <Button asChild>
                <Link href={projectPath("/my-projects", projectId)}>Voir le projet</Link>
              </Button>
            }
          />
        ) : (
          <>
            <div className="mb-6">
              <GroupMembers group={group} />
            </div>

            <Tabs value={tab} onValueChange={changeTab} className="space-y-4">
              <TabsList>
                <TabsTrigger value="deliverables">Livrables</TabsTrigger>
                <TabsTrigger value="reports">Rapport</TabsTrigger>
              </TabsList>

              <TabsContent value="deliverables" className="space-y-4">
                {deliverables.length === 0 ? (
                  <EmptyState
                    icon={FileText}
                    title="Aucun livrable pour ce projet"
                    description="Votre enseignant n’a pas encore défini de livrable à rendre. Il apparaîtra ici dès qu’il sera créé."
                  />
                ) : (
                  [...deliverables]
                    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
                    .map((deliverable) => (
                      <StudentDeliverableCard
                        key={deliverable.id}
                        deliverable={deliverable}
                        groupId={group.id}
                        projectId={Number(project.id)}
                        onChanged={() => load(true)}
                      />
                    ))
                )}
              </TabsContent>

              {/* Toujours monté : changer d’onglet ne doit pas interrompre la rédaction ni perdre un texte en attente d’enregistrement. */}
              <TabsContent value="reports" forceMount className="space-y-4 data-[state=inactive]:hidden">
                <StudentReportView projectId={Number(projectId)} groupId={group.id} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </PageContainer>
    </MainLayout>
  )
}

function GroupMembers({ group }: { group: ProjectGroup }) {
  return (
    <SectionCard title={group.name} description="Membres de votre groupe">
      {group.members.length === 0 ? (
        <QuietEmpty>Aucun membre pour l’instant.</QuietEmpty>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {group.members.map((member) => (
            <li key={member.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="text-xs">{initials(member)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{fullName(member)}</p>
                <p className="truncate text-xs text-muted-foreground">{member.email}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}

function BackToProject({ projectId }: { projectId: string }) {
  return (
    <Link
      href={projectPath("/my-projects", projectId)}
      className="mb-4 inline-flex items-center gap-1 rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <ArrowLeft aria-hidden="true" className="h-4 w-4" />
      Retour au projet
    </Link>
  )
}
