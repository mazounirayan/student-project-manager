"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { MainLayout } from "@/components/layout/main-layout"
import { PageContainer, PageHeader } from "@/components/layout/page"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Eye, EyeOff, FileText, MoreHorizontal, Pencil, Plus, Trash2, Users } from "lucide-react"
import { useEffect, useMemo, useState, useCallback } from "react"
import GroupsBoard from "@/components/groups/GroupsBoard"
import { DeliverableDialog, type DeliverableFormValues } from "@/components/projects/deliverable-dialog"
import { DeliverablesList } from "@/components/projects/deliverablesList-dialog"
import { DefensesTab } from "@/components/projects/DefensesTab"
import { ProjectGradingSection } from "@/components/projects/ProjectGradingSection"
import { DeliverableGradingPanel } from "@/components/grading/DeliverableGradingPanel"
import { apiPost, apiPut, errorMessage } from "@/lib/api"
import type { DefenseSlot } from "@/lib/defenses"
import type { Deliverable } from "@/lib/deliverables"
import { TeacherReportsView } from "@/components/reports/TeacherReportsView"
import { DefenseGradingPanel } from "@/components/grading/DefenseGradingPanel"
import { EmptyState } from "@/components/shared/EmptyState"
import { ErrorState } from "@/components/shared/ErrorState"
import { DetailSkeleton } from "@/components/shared/Skeletons"
import { deleteProject, getProjectById, updateProject, type Project, type UpdateProjectPayload } from "@/services/project.service"
import { promotionService, type Promotion } from "@/services/PromotionService"
import { formatDate, formatDateLong, plural } from "@/lib/format"
import { toast } from "sonner"
import { ProjectStatusBadge } from "@/components/projects/project-status-badge"
import { EditProjectDialog } from "@/components/projects/edit-project-dialog"
import { ProjectOverview } from "@/components/projects/project-overview"
import { confirmDeleteProject, confirmVisibility, groupsOf, studentsOf, ungroupedStudents, type ChecklistAction } from "@/lib/projects"
import { useRouteProjectId } from "@/lib/routes"

interface ProjectPageProps {
  params: {
    id: string
  }
}

type Student = { id: number; firstName: string; lastName: string; email: string }
type Group = { id: number; name: string; capacity: number; members: Student[] }
const TABS = ["overview", "groups", "deliverables", "reports", "defenses", "grading"] as const
type TabValue = (typeof TABS)[number]

export function ProjectPageContent({ params }: ProjectPageProps) {
  const router = useRouter()
  const [tab, setTab] = useState<TabValue>("overview")
  const [editOpen, setEditOpen] = useState(false)
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [project, setProject] = useState<Project | null>(null)
  const [defenses, setDefenses] = useState<DefenseSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deliverableDialog, setDeliverableDialog] = useState<{ open: boolean; deliverable: Deliverable | null }>({
    open: false,
    deliverable: null,
  })

  const [gradingDeliverable, setGradingDeliverable] = useState<string | null>(null)
  /** Groupe à ouvrir en premier dans la notation (liens « Noter » d’un groupe précis). */
  const [gradingGroup, setGradingGroup] = useState<number | undefined>()
  const [scrollTarget, setScrollTarget] = useState<string | null>(null)
  /** Change à chaque note enregistrée : l’onglet Soutenances recharge l’état des notes. */
  const [notesTick, setNotesTick] = useState(0)

  const projectId = useRouteProjectId(params.id)

  const loadProject = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getProjectById(projectId)
      setProject(data)
      setDefenses((data.defenses ?? []) as DefenseSlot[])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger ce projet.")
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    loadProject()
  }, [loadProject])

  // L’onglet ouvert est repris dans l’adresse (#groups), pour partager ou retrouver la page telle quelle.
  // #deliverables/12/3 : notation du livrable 12, groupe 3 ; #defenses/3 : notation de la soutenance du groupe 3.
  const openFromHash = useCallback(() => {
    const [fromHash, first, second] = window.location.hash.slice(1).split("/")
    if (!TABS.includes(fromHash as TabValue)) return
    setTab(fromHash as TabValue)
    if (fromHash === "deliverables" && Number(first) > 0) {
      setGradingDeliverable(first)
      setGradingGroup(Number(second) > 0 ? Number(second) : undefined)
      setScrollTarget("notation-livrables")
    }
    if (fromHash === "defenses" && Number(first) > 0) {
      setGradingGroup(Number(first))
      setScrollTarget("notation-soutenances")
    }
  }, [])

  useEffect(() => {
    openFromHash()
    window.addEventListener("hashchange", openFromHash)
    return () => window.removeEventListener("hashchange", openFromHash)
  }, [openFromHash])

  const goToGrading = useCallback((deliverableId: number, groupId?: number) => {
    setGradingDeliverable(String(deliverableId))
    setGradingGroup(groupId)
    setScrollTarget("notation-livrables")
  }, [])

  const goToDefenseGrading = useCallback((groupId: number) => {
    setGradingGroup(groupId)
    setScrollTarget("notation-soutenances")
    window.history.replaceState(null, "", `#defenses/${groupId}`)
  }, [])

  useEffect(() => {
    if (!scrollTarget || loading) return
    document.getElementById(scrollTarget)?.scrollIntoView({ behavior: "smooth", block: "start" })
    setScrollTarget(null)
  }, [scrollTarget, loading])

  const changeTab = useCallback((value: string) => {
    setTab(value as TabValue)
    window.history.replaceState(null, "", `#${value}`)
  }, [])

  const handleRefresh = useCallback(async () => {
    try {
      const data = await getProjectById(projectId)
      setProject(data)
      setDefenses((data.defenses ?? []) as DefenseSlot[])
    } catch (err) {
      toast.error(errorMessage(err, "Impossible d’actualiser le projet."))
    }
  }, [projectId])

  const saveDeliverable = useCallback(
    async (values: DeliverableFormValues) => {
      const editing = deliverableDialog.deliverable
      const payload = { ...values, projectId: Number(projectId) }
      try {
        if (editing) await apiPut(`/deliverables/${editing.id}`, payload)
        else await apiPost("/deliverables", payload)
        await handleRefresh()
        toast.success(editing ? "Livrable mis à jour." : "Livrable créé.")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Impossible d’enregistrer le livrable.")
        throw err
      }
    },
    [deliverableDialog.deliverable, handleRefresh, projectId],
  )

  const students: Student[] = useMemo(() => (project ? studentsOf(project) : []), [project])

  const groups: Group[] = useMemo(
    () =>
      ((project?.groups ?? []) as Array<Record<string, unknown>>).map((group) => ({
        id: group.id as number,
        name: group.name as string,
        capacity: project?.maxGroupSize ?? 4,
        members: ((group.members ?? []) as Student[]).map((member) => ({
          id: member.id,
          firstName: member.firstName,
          lastName: member.lastName,
          email: member.email,
        })),
      })),
    [project?.groups, project?.maxGroupSize],
  )

  const waitingCount = project ? ungroupedStudents(project).length : 0

  const openEdit = async () => {
    if (promotions.length === 0) setPromotions(await promotionService.getAll().catch(() => [] as Promotion[]))
    setEditOpen(true)
  }

  const saveProject = async (payload: UpdateProjectPayload) => {
    if (!project) return
    await updateProject(project.id, payload)
    setEditOpen(false)
    toast.success("Projet mis à jour.")
    await handleRefresh()
  }

  const toggleVisibility = async () => {
    if (!project) return
    const makeVisible = project.status !== "visible"
    if (!(await confirmVisibility(project, makeVisible))) return
    try {
      await updateProject(project.id, { status: makeVisible ? "visible" : "draft" })
      toast.success(makeVisible ? "Le projet est visible par les étudiants." : "Le projet repasse en brouillon.")
      await handleRefresh()
    } catch (err) {
      toast.error("Le statut du projet n’a pas changé.", { description: errorMessage(err, "Réessayez dans un instant.") })
    }
  }

  const removeProject = async () => {
    if (!project || !(await confirmDeleteProject(project))) return
    try {
      await deleteProject(project.id)
      toast.success(`Projet « ${project.name} » supprimé.`)
      router.push("/projects")
    } catch (err) {
      toast.error("Le projet n’a pas été supprimé.", { description: errorMessage(err, "Réessayez dans un instant.") })
    }
  }

  const runChecklistAction = (action: ChecklistAction) => {
    if (action === "publish") void toggleVisibility()
    else changeTab(action)
  }

  if (loading) {
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
          <BackToProjects />
          <ErrorState message={error ?? "Projet introuvable."} onRetry={loadProject} />
        </PageContainer>
      </MainLayout>
    )
  }

  const deliverables = (project.deliverables ?? []) as Deliverable[]

  const visible = project.status === "visible"

  return (
    <MainLayout>
      <PageContainer>
        <BackToProjects />
        <PageHeader
          title={project.name}
          description={`${project.promotionName ?? "Promotion inconnue"} · ${plural(students.length, "étudiant")} · créé le ${formatDate(project.createdAt)}`}
          actions={
            <>
              <ProjectStatusBadge status={project.status} />
              {!visible && (
                <Button onClick={toggleVisibility}>
                  <Eye aria-hidden="true" className="h-4 w-4" />
                  Rendre visible
                </Button>
              )}
              <Button variant="outline" onClick={openEdit}>
                <Pencil aria-hidden="true" className="h-4 w-4" />
                Modifier
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Autres actions sur le projet">
                    <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {visible && (
                    <DropdownMenuItem onSelect={toggleVisibility}>
                      <EyeOff aria-hidden="true" className="h-4 w-4" />
                      Repasser en brouillon
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem variant="destructive" onSelect={removeProject}>
                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                    Supprimer le projet
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          }
        />

        <Tabs value={tab} onValueChange={changeTab} className="space-y-4">
          <div className="-mx-1 overflow-x-auto px-1 pb-1">
            <TabsList className="w-max">
              <TabsTrigger value="overview">Vue d’ensemble</TabsTrigger>
              <TabsTrigger value="groups">
                Groupes
                {waitingCount > 0 && (
                  <>
                    <span aria-hidden="true" className="rounded-full bg-primary px-1.5 text-[11px] leading-4 tabular-nums text-primary-foreground">
                      {waitingCount}
                    </span>
                    <span className="sr-only">({plural(waitingCount, "étudiant")} sans groupe)</span>
                  </>
                )}
              </TabsTrigger>
              <TabsTrigger value="deliverables">Livrables</TabsTrigger>
              <TabsTrigger value="reports">Rapports</TabsTrigger>
              <TabsTrigger value="defenses">Soutenances</TabsTrigger>
              <TabsTrigger value="grading">Notation</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview">
            <ProjectOverview project={project} onAction={runChecklistAction} />
          </TabsContent>

          <TabsContent value="defenses">
            <DefensesTab
              projectId={Number(project.id)}
              visible={visible}
              groups={groups}
              defenses={defenses}
              onChange={setDefenses}
              onGrade={goToDefenseGrading}
              onOpenGroups={() => changeTab("groups")}
              notesKey={notesTick}
            />
            <Card id="notation-soutenances" className="mt-6 scroll-mt-6">
              <CardHeader>
                <CardTitle>Notation des soutenances</CardTitle>
                <CardDescription>Notez chaque groupe pendant ou juste après son passage. Enregistrez un brouillon, puis validez la note.</CardDescription>
              </CardHeader>
              <CardContent>
                <DefenseGradingPanel projectId={project.id} groups={groups} defenses={defenses} initialGroupId={gradingGroup} onChanged={() => setNotesTick((tick) => tick + 1)} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="groups">
            <GroupsBoard
              project={project}
              students={students}
              initialGroups={groupsOf(project)}
              onGroupsChange={(next) => setProject((current) => (current ? { ...current, groups: next } : current))}
            />
          </TabsContent>

          <TabsContent value="deliverables">
            <div className="space-y-6">
              <section className="space-y-4" aria-labelledby="deliverables-title">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h2 id="deliverables-title" className="text-lg font-semibold">
                      Livrables du projet
                    </h2>
                    <p className="text-sm text-muted-foreground">
                      Ce que chaque groupe doit rendre, les règles que les rendus doivent respecter, et qui a rendu quoi.
                    </p>
                  </div>
                  <Button onClick={() => setDeliverableDialog({ open: true, deliverable: null })}>
                    <Plus aria-hidden="true" className="h-4 w-4" />
                    Nouveau livrable
                  </Button>
                </div>

                {deliverables.length === 0 ? (
                  <EmptyState
                    icon={FileText}
                    title="Aucun livrable pour ce projet"
                    description="Créez un livrable pour que les groupes puissent déposer leur travail. Vous pourrez y ajouter des règles de conformité, repérer les ressemblances entre rendus et noter."
                    action={
                      <Button onClick={() => setDeliverableDialog({ open: true, deliverable: null })}>
                        <Plus aria-hidden="true" className="h-4 w-4" />
                        Créer le premier livrable
                      </Button>
                    }
                  />
                ) : (
                  <DeliverablesList
                    groups={groups}
                    deliverables={deliverables}
                    onEdit={(deliverable) => setDeliverableDialog({ open: true, deliverable })}
                    onChanged={handleRefresh}
                    onGrade={goToGrading}
                  />
                )}
              </section>

              <Card id="notation-livrables" className="scroll-mt-6">
                <CardHeader>
                  <CardTitle>Notation des livrables</CardTitle>
                  <CardDescription>Choisissez un livrable, puis notez les groupes un à un avec son rendu sous les yeux.</CardDescription>
                </CardHeader>
                <CardContent>
                  {deliverables.length === 0 ? (
                    <EmptyState
                      icon={FileText}
                      title="Aucun livrable à noter"
                      description="Créez d’abord un livrable ci-dessus : sa grille de notation se crée ensuite ici."
                    />
                  ) : !groups.length ? (
                    <EmptyState
                      icon={Users}
                      title="Aucun groupe à noter"
                      description="Constituez les groupes dans l’onglet Groupes : ils pourront ensuite être notés ici."
                    />
                  ) : (
                    <Tabs value={gradingDeliverable ?? String(deliverables[0]?.id)} onValueChange={setGradingDeliverable} className="space-y-4">
                      <div className="-mx-1 overflow-x-auto px-1 pb-1">
                        <TabsList className="w-max">
                          {deliverables.map((d) => (
                            <TabsTrigger key={d.id} value={String(d.id)}>
                              {d.name}
                            </TabsTrigger>
                          ))}
                        </TabsList>
                      </div>

                      {deliverables.map((d) => (
                        <TabsContent key={d.id} value={String(d.id)} className="space-y-4">
                          <p className="text-sm text-muted-foreground">
                            Échéance : {formatDateLong(d.deadline)} · {plural(d.submissions?.length ?? 0, "rendu")} sur {plural(groups.length, "groupe")}
                          </p>
                          <DeliverableGradingPanel
                            projectId={project.id}
                            deliverable={d}
                            groups={groups}
                            initialGroupId={String(d.id) === gradingDeliverable ? gradingGroup : undefined}
                          />
                        </TabsContent>
                      ))}
                    </Tabs>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="reports">
            <TeacherReportsView projectId={project.id} />
          </TabsContent>

          <TabsContent value="grading">
            <ProjectGradingSection project={project} onRefresh={handleRefresh} />
          </TabsContent>
        </Tabs>

        <DeliverableDialog
          open={deliverableDialog.open}
          onOpenChange={(open) => setDeliverableDialog((state) => ({ ...state, open }))}
          deliverable={deliverableDialog.deliverable}
          onSubmit={saveDeliverable}
        />

        <EditProjectDialog open={editOpen} onOpenChange={setEditOpen} project={project} promotions={promotions} onSave={saveProject} />
      </PageContainer>
    </MainLayout>
  )
}

function BackToProjects() {
  return (
    <Link
      href="/projects"
      className="mb-4 inline-flex items-center gap-1 rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <ArrowLeft aria-hidden="true" className="h-4 w-4" />
      Projets
    </Link>
  )
}
