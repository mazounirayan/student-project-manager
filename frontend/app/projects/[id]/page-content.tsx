"use client"

import { MainLayout } from "@/components/layout/main-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Users, FileText, BookOpen, Download, AlertCircle, Calendar } from "lucide-react"
import { useEffect, useMemo, useState, useCallback } from "react"
import GroupsBoard from "@/components/groups/GroupsBoard"
import { CreateDeliverableDialog } from "@/components/projects/create-deliverable-dialog"
import { EditDeliverableDialog } from "@/components/projects/edit-deliverable-dialog"
import { DeliverablesList } from "@/components/projects/deliverablesList-dialog"
import { ScheduleDefenseDialog } from "@/components/projects/schedule-defense-dialog"
import DefenseOrderTable from "@/components/projects/DefenseOrderTable"
import { ProjectGradingSection } from "@/components/projects/ProjectGradingSection"
import { DeliverableConstraintDialog } from "@/components/projects/deliverable-constraint-dialog"
import { ProjectGradingOverview } from "@/components/grading/project-grading-overview"
import { ReportGradingPanel } from "@/components/grading/ReportGradingPanel"
import { CreateGradingGridDialog } from "@/components/grading/CreateGradingGridDialog"
import { DeliverableGradingPanel } from "@/components/grading/DeliverableGradingPanel"
import { apiGet, apiPost, apiPut } from "@/lib/api"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { TeacherReportsView } from "@/components/reports/TeacherReportsView"
import { DefenseGradingPanel } from "@/components/grading/DefenseGradingPanel"
import { ErrorState } from "@/components/shared/ErrorState"
import { DetailSkeleton } from "@/components/shared/Skeletons"
import { getProjectById, type Project } from "@/services/project.service"
import { formatDate } from "@/lib/date"
import { toast } from "sonner"

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

export function ProjectPageContent({ params }: ProjectPageProps) {
  const [project, setProject] = useState<Project | null>(null)
  const [defenses, setDefenses] = useState<Defense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editDeliverableOpen, setEditDeliverableOpen] = useState(false)
  const [selectedDeliverable, setSelectedDeliverable] = useState<Record<string, any> | null>(null)

  const projectId = useMemo(() => params.id, [params.id])

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

  const handleRefresh = useCallback(async () => {
    try {
      const data = await getProjectById(projectId)
      setProject(data)
      setDefenses((data.defenses ?? []) as Defense[])
    } catch {
      toast.error("Impossible d'actualiser le projet.")
    }
  }, [projectId])

  const handleDeliverableCreated = useCallback(
    async (deliverable: Record<string, unknown>) => {
      try {
        await apiPost("/deliverables", { ...deliverable, projectId: Number(projectId) })
        await handleRefresh()
        toast.success("Livrable créé avec succès.")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Une erreur est survenue lors de la création du livrable.")
      }
    },
    [handleRefresh, projectId],
  )

  const handleEditDeliverable = useCallback((deliverable: Record<string, any>) => {
    setSelectedDeliverable(deliverable)
    setEditDeliverableOpen(true)
  }, [])

  const handleDefenseScheduled = useCallback(
    async (defenseData: Record<string, unknown>) => {
      try {
        const data = await apiPost<{ defenses?: Defense[] }>(`/defenses/projects/${projectId}/schedule`, defenseData)
        toast.success("Soutenances planifiées avec succès.")
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

  const handleConstraintAdded = useCallback(
    async (constraint: { deliverableId?: number; type: string; configuration: string; errorMessage?: string }) => {
      if (!constraint.deliverableId) return

      let configuration: unknown = constraint.configuration

      switch (constraint.type) {
        case "max_size": {
          const sizeMatch = /(\d+(?:\.\d+)?)/.exec(constraint.configuration)
          configuration = { maxSizeMB: sizeMatch ? Number.parseFloat(sizeMatch[1]) : 0 }
          break
        }
        case "folder_structure":
        case "file_content":
        case "file_presence": {
          try {
            configuration = JSON.parse(constraint.configuration)
          } catch {
            toast.error("La configuration doit être un JSON valide.")
            return
          }
          break
        }
        default:
          configuration = constraint.configuration
          break
      }

      try {
        await apiPost(`/deliverables/${constraint.deliverableId}/rules`, {
          type: constraint.type,
          configuration,
          errorMessage: constraint.errorMessage || null,
        })
        await handleRefresh()
        toast.success("Contrainte ajoutée.")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Impossible d'ajouter la contrainte.")
      }
    },
    [handleRefresh],
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
        toast.error(err instanceof Error ? err.message : "Impossible de sauvegarder l'ordre.")
      }
    },
    [projectId],
  )

  const handleDownloadSchedule = useCallback(async () => {
    try {
      await apiGet(`/defenses/projects/${projectId}/schedule/pdf`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Le téléchargement du planning n'est pas disponible.")
    }
  }, [projectId])

  const handleDownloadAttendanceSheet = useCallback(async () => {
    try {
      await apiGet(`/defenses/projects/${projectId}/attendance/pdf`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Le téléchargement de la fiche d'émargement n'est pas disponible.")
    }
  }, [projectId])

  const students: Student[] = useMemo(
    () => ((project as unknown as { promotion?: { students?: Student[] } })?.promotion?.students ?? []),
    [(project as unknown as { promotion?: { students?: Student[] } })?.promotion?.students],
  )

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

  const assignedIds = useMemo(() => new Set(groups.flatMap((g) => g.members.map((m) => m.id))), [groups])

  const ungroupedStudents = useMemo(
    () => students.filter((s) => !assignedIds.has(s.id)),
    [students, assignedIds],
  )

  const stats = useMemo(
    () => [
      { title: "Étudiants", value: students.length, icon: Users },
      { title: "Groupes", value: groups.length, icon: Users },
      { title: "Livrables", value: (project?.deliverables ?? []).length, icon: FileText },
      { title: "Rapports", value: (project?.reports ?? []).length, icon: BookOpen },
    ],
    [students.length, groups.length, project?.deliverables, project?.reports],
  )

  const getStatusBadge = (status: string | undefined) => {
    switch (status) {
      case "draft":
        return <Badge variant="secondary">Brouillon</Badge>
      case "visible":
        return <Badge variant="default">Visible</Badge>
      case "completed":
        return <Badge variant="outline">Terminé</Badge>
      default:
        return <Badge variant="secondary">Inconnu</Badge>
    }
  }

  const getDeliverableStatus = (deliverable: { deadline: string }) => {
    const now = new Date()
    const deadline = new Date(deliverable.deadline)

    if (now > deadline) {
      return <Badge variant="destructive">Échue</Badge>
    } else if (deadline.getTime() - now.getTime() < 7 * 24 * 60 * 60 * 1000) {
      return <Badge variant="secondary">Échéance proche</Badge>
    } else {
      return <Badge variant="default">À venir</Badge>
    }
  }

  if (loading) {
    return (
      <MainLayout>
        <div className="p-6">
          <DetailSkeleton />
        </div>
      </MainLayout>
    )
  }

  if (error || !project) {
    return (
      <MainLayout>
        <div className="p-6">
          <ErrorState message={error ?? "Projet introuvable."} onRetry={loadProject} />
        </div>
      </MainLayout>
    )
  }

  const deliverables = (project.deliverables ?? []) as Array<Record<string, any>>

  return (
    <MainLayout>
      <div className="p-6">
        <div className="mb-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold text-foreground">{project?.name}</h1>
              <p className="flex flex-wrap items-center gap-2 text-muted-foreground">
                <span>{project?.promotionName}</span>
                <span aria-hidden="true">•</span>
                <span>Créé le {formatDate(project?.createdAt)}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">{getStatusBadge(project?.status)}</div>
          </div>

          <p className="text-muted-foreground">{project?.description}</p>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-4">
          {stats?.map((stat) => {
            const Icon = stat.icon
            return (
              <Card key={stat.title}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{stat?.title}</CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat?.value}</div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="flex-wrap">
            <TabsTrigger value="overview">Soutenance</TabsTrigger>
            <TabsTrigger value="groups">Groupes</TabsTrigger>
            <TabsTrigger value="deliverables">Livrables</TabsTrigger>
            <TabsTrigger value="reports">Rapports</TabsTrigger>
            <TabsTrigger value="grading">Notation</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <Card>
              <CardHeader>
                <CardTitle>Ordre de passage</CardTitle>
                <CardDescription>Planifiez les soutenances et réorganisez l'ordre des groupes.</CardDescription>
                <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
                  <ScheduleDefenseDialog
                    projectId={params.id}
                    onDefenseScheduled={handleDefenseScheduled}
                    groupCount={groups?.length}
                  />
                  <Button size="sm" onClick={handleDownloadSchedule}>
                    <Calendar aria-hidden="true" className="mr-2 h-4 w-4" />
                    Télécharger le planning
                  </Button>
                  <Button size="sm" onClick={handleDownloadAttendanceSheet}>
                    <Download aria-hidden="true" className="mr-2 h-4 w-4" />
                    Télécharger la fiche d'émargement
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
            <GroupsBoard projectId={project?.id} initialUnassigned={ungroupedStudents} initialGroups={groups} />
          </TabsContent>

          <TabsContent value="deliverables">
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle>Livrables du projet</CardTitle>
                      <CardDescription>Configurez et suivez les livrables</CardDescription>
                    </div>
                    <CreateDeliverableDialog
                      projectId={params.id}
                      onDeliverableCreated={handleDeliverableCreated}
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <DeliverablesList
                    project={project}
                    getDeliverableStatus={getDeliverableStatus}
                    formatDeadline={formatDate}
                    handleConstraintAdded={handleConstraintAdded}
                    handleEditDeliverable={handleEditDeliverable}
                  />
                </CardContent>
              </Card>

              <Card>
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
                        Créez d'abord des livrables ci-dessus pour commencer la notation
                      </p>
                    </div>
                  ) : (
                    <Tabs defaultValue={String(deliverables[0]?.id)} className="space-y-4">
                      <TabsList className="flex w-full flex-wrap">
                        {deliverables.map((d) => (
                          <TabsTrigger key={d.id} value={String(d.id)} className="flex items-center gap-2">
                            <FileText className="h-4 w-4" aria-hidden="true" />
                            {d.name || d.title}
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
                                  <strong>Échéance :</strong> {formatDate(d.deadline, "fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                                </span>
                                <span aria-hidden="true" className="text-muted-foreground">•</span>
                                <span>
                                  <strong>{d.submissions?.length || 0}</strong> soumission
                                  {d.submissions?.length > 1 ? "s" : ""}
                                </span>
                              </div>
                            </AlertDescription>
                          </Alert>

                          {!groups.length ? (
                            <Alert variant="destructive">
                              <AlertCircle className="h-4 w-4" aria-hidden="true" />
                              <AlertDescription>
                                Aucun groupe n'a été créé pour ce projet. Créez des groupes dans l'onglet « Groupes » pour
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
              <ProjectGradingOverview projectId={Number(params.id)} />

              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle>Grilles de notation</CardTitle>
                      <CardDescription>
                        Créez des grilles et définissez des critères pour chaque type d'évaluation
                      </CardDescription>
                    </div>
                    <CreateGradingGridDialog
                      projectId={Number(params.id)}
                      deliverables={deliverables.map((d) => ({ id: Number(d.id), title: String(d.name ?? d.title ?? "") }))}
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

        {selectedDeliverable && (
          <EditDeliverableDialog
            deliverable={selectedDeliverable}
            open={editDeliverableOpen}
            onOpenChange={setEditDeliverableOpen}
            onDeliverableUpdated={handleRefresh}
          />
        )}
      </div>
    </MainLayout>
  )
}
