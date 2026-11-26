"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { MainLayout } from "@/components/layout/main-layout"
import { PageContainer, PageHeader } from "@/components/layout/page"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowLeft, Download, AlertCircle, Calendar, Eye, EyeOff, FileText, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react"
import { useEffect, useMemo, useState, useCallback } from "react"
import GroupsBoard from "@/components/groups/GroupsBoard"
import { DeliverableDialog, type DeliverableFormValues } from "@/components/projects/deliverable-dialog"
import { DeliverablesList } from "@/components/projects/deliverablesList-dialog"
import { ScheduleDefenseDialog } from "@/components/projects/schedule-defense-dialog"
import DefenseOrderTable from "@/components/projects/DefenseOrderTable"
import { ProjectGradingSection } from "@/components/projects/ProjectGradingSection"
import { ProjectGradingOverview } from "@/components/grading/project-grading-overview"
import { CreateGradingGridDialog } from "@/components/grading/CreateGradingGridDialog"
import { DeliverableGradingPanel } from "@/components/grading/DeliverableGradingPanel"
import { apiPost, apiPut, downloadFile, errorMessage } from "@/lib/api"
import type { Deliverable } from "@/lib/deliverables"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
type Defense = {
  id: number
  group?: { id: number; name: string } | null
  startTime: string
  endTime: string
  orderIndex: number
  location?: string | null
}

const TABS = ["overview", "groups", "deliverables", "reports", "defenses", "grading"] as const
type TabValue = (typeof TABS)[number]

export function ProjectPageContent({ params }: ProjectPageProps) {
  const router = useRouter()
  const [tab, setTab] = useState<TabValue>("overview")
  const [editOpen, setEditOpen] = useState(false)
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [project, setProject] = useState<Project | null>(null)
  const [defenses, setDefenses] = useState<Defense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deliverableDialog, setDeliverableDialog] = useState<{ open: boolean; deliverable: Deliverable | null }>({
    open: false,
    deliverable: null,
  })

  const [gradingDeliverable, setGradingDeliverable] = useState<string | null>(null)
  const [scrollToGrading, setScrollToGrading] = useState(false)

  const projectId = useRouteProjectId(params.id)

  const loadProject = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getProjectById(projectId)
      setProject(data)
      setDefenses((data.defenses ?? []) as Defense[])
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
  useEffect(() => {
    const [fromHash, deliverableId] = window.location.hash.slice(1).split("/")
    if (TABS.includes(fromHash as TabValue)) setTab(fromHash as TabValue)
    // #deliverables/12 : ouvre la notation du livrable 12 (lien « Noter » de la page Livrables).
    if (fromHash === "deliverables" && Number(deliverableId) > 0) {
      setGradingDeliverable(deliverableId)
      setScrollToGrading(true)
    }
  }, [])

  const goToGrading = useCallback((deliverableId: number) => {
    setGradingDeliverable(String(deliverableId))
    setScrollToGrading(true)
  }, [])

  useEffect(() => {
    if (!scrollToGrading || loading) return
    document.getElementById("notation-livrables")?.scrollIntoView({ behavior: "smooth", block: "start" })
    setScrollToGrading(false)
  }, [scrollToGrading, loading])

  const changeTab = useCallback((value: string) => {
    setTab(value as TabValue)
    window.history.replaceState(null, "", `#${value}`)
  }, [])

  const handleRefresh = useCallback(async () => {
    try {
      const data = await getProjectById(projectId)
      setProject(data)
      setDefenses((data.defenses ?? []) as Defense[])
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

  const handleDefenseScheduled = useCallback(
    async (defenseData: Record<string, unknown>) => {
      try {
        const data = await apiPost<{ defenses?: Defense[] }>(`/defenses/projects/${projectId}/schedule`, defenseData)
        toast.success("Soutenances planifiées.")
        if (data?.defenses) {
          setDefenses(data.defenses)
        }
        await handleRefresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erreur lors de la planification de la soutenance.")
      }
    },
    [projectId, handleRefresh],
  )

  const handlePersistOrder = useCallback(
    async (next: Defense[]) => {
      if (!Array.isArray(next) || next.some((d) => !d?.group?.id || !Number.isFinite(d.orderIndex))) {
        toast.error("Ordre de passage invalide.")
        return
      }

      const payload = {
        newOrder: next.map((d) => ({ groupId: Number(d.group!.id), orderIndex: Number(d.orderIndex) })),
      }

      try {
        const data = await apiPut<{ defenses: Defense[] }>(`/defenses/projects/${projectId}/reorder`, payload)
        toast.success("Ordre de passage enregistré.")
        if (data?.defenses) {
          setDefenses(data.defenses)
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Impossible de sauvegarder l’ordre.")
      }
    },
    [projectId],
  )

  const handleDownloadSchedule = useCallback(async () => {
    try {
      await downloadFile(`/defenses/projects/${projectId}/schedule/pdf`, "planning-soutenances.pdf")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Le téléchargement du planning n’est pas disponible.")
    }
  }, [projectId])

  const handleDownloadAttendanceSheet = useCallback(async () => {
    try {
      await downloadFile(`/defenses/projects/${projectId}/attendance/pdf`, "emargement-soutenances.pdf")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Le téléchargement de la fiche d’émargement n’est pas disponible.")
    }
  }, [projectId])

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
            <Card>
              <CardHeader>
                <CardTitle>Ordre de passage</CardTitle>
                <CardDescription>Planifiez les soutenances et réorganisez l’ordre des groupes.</CardDescription>
                <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
                  <ScheduleDefenseDialog
                    onDefenseScheduled={handleDefenseScheduled}
                    groupCount={groups?.length}
                  />
                  <Button size="sm" onClick={handleDownloadSchedule}>
                    <Calendar aria-hidden="true" className="mr-2 h-4 w-4" />
                    Télécharger le planning
                  </Button>
                  <Button size="sm" onClick={handleDownloadAttendanceSheet}>
                    <Download aria-hidden="true" className="mr-2 h-4 w-4" />
                    Télécharger la fiche d’émargement
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <DefenseOrderTable defenses={defenses} onOrderChange={handlePersistOrder} />
              </CardContent>
            </Card>
            <DefenseGradingPanel projectId={project.id} groups={groups || []} />
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
                  <CardDescription>Évaluez directement les livrables rendus par les groupes</CardDescription>
                </CardHeader>
                <CardContent>
                  {deliverables.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <FileText className="mb-4 h-12 w-12 text-muted-foreground" aria-hidden="true" />
                      <p className="text-lg font-medium text-muted-foreground">Aucun livrable à noter</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Créez d’abord des livrables ci-dessus pour commencer la notation
                      </p>
                    </div>
                  ) : (
                    <Tabs value={gradingDeliverable ?? String(deliverables[0]?.id)} onValueChange={setGradingDeliverable} className="space-y-4">
                      <TabsList className="flex w-full flex-wrap">
                        {deliverables.map((d) => (
                          <TabsTrigger key={d.id} value={String(d.id)} className="flex flex-wrap items-center gap-2">
                            <FileText className="h-4 w-4" aria-hidden="true" />
                            {d.name}
                          </TabsTrigger>
                        ))}
                      </TabsList>

                      {deliverables.map((d) => (
                        <TabsContent key={d.id} value={String(d.id)} className="space-y-4">
                          <Alert>
                            <AlertCircle className="h-4 w-4" aria-hidden="true" />
                            <AlertDescription>
                              <div className="flex flex-wrap items-center gap-3 text-sm">
                                <span>
                                  <strong>Livrable :</strong> {d.name}
                                </span>
                                <span aria-hidden="true" className="text-muted-foreground">•</span>
                                <span>
                                  <strong>Échéance :</strong> {formatDateLong(d.deadline)}
                                </span>
                                <span aria-hidden="true" className="text-muted-foreground">•</span>
                                <span>
                                  <strong>{d.submissions?.length ?? 0}</strong> rendu
                                  {(d.submissions?.length ?? 0) > 1 ? "s" : ""}
                                </span>
                              </div>
                            </AlertDescription>
                          </Alert>

                          {!groups.length ? (
                            <Alert variant="destructive">
                              <AlertCircle className="h-4 w-4" aria-hidden="true" />
                              <AlertDescription>
                                Aucun groupe n’a été créé pour ce projet. Créez des groupes dans l’onglet « Groupes » pour
                                commencer la notation.
                              </AlertDescription>
                            </Alert>
                          ) : (
                            <DeliverableGradingPanel
                              key={`deliverable-${d.id}`}
                              deliverableId={d.id}
                              projectId={project.id}
                              groups={groups}
                            />
                          )}
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
            <div className="space-y-6">
              <ProjectGradingOverview projectId={Number(projectId)} />

              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle>Grilles de notation</CardTitle>
                      <CardDescription>
                        Créez des grilles et définissez des critères pour chaque type d’évaluation
                      </CardDescription>
                    </div>
                    <CreateGradingGridDialog
                      projectId={Number(projectId)}
                      onGridCreated={handleRefresh}
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <ProjectGradingSection project={project} onRefresh={handleRefresh} />
                </CardContent>
              </Card>
            </div>
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
