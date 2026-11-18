"use client"

import { MainLayout } from "@/components/layout/main-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileText, Calendar, Users, Clock, AlertTriangle, FolderOpen, CheckCircle } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { fetchMyProjects, getProjectById, type Project } from "@/services/project.service"
import { ErrorState } from "@/components/shared/ErrorState"
import { EmptyState } from "@/components/shared/EmptyState"
import { CardsSkeleton } from "@/components/shared/Skeletons"
import { formatDateTime, daysUntil } from "@/lib/date"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

type Submission = {
  id: number
  groupId: number
  group?: { id: number; name: string } | null
  fileName?: string | null
  gitUrl?: string | null
  submittedAt: string
  isLate: boolean
  similarityScore?: number | null
}
type Deliverable = {
  id: number
  name: string
  description: string
  type: "archive" | "git_link"
  deadline: string
  submissions?: Submission[]
}

export default function DeliverablesPage() {
  return (
    <ProtectedRoute roles={["teacher"]}>
      <DeliverablesPageContent />
    </ProtectedRoute>
  )
}

function DeliverablesPageContent() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [deliverables, setDeliverables] = useState<Deliverable[]>([])
  const [loading, setLoading] = useState(true)
  const [projectLoading, setProjectLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const loadProjects = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchMyProjects()
      const list = Array.isArray(data) ? data : []
      setProjects(list)
      if (list.length > 0 && !selectedProjectId) {
        setSelectedProjectId(String(list[0].id))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger vos projets.")
    } finally {
      setLoading(false)
    }
  }, [selectedProjectId])

  const loadProject = useCallback(async () => {
    if (!selectedProjectId) return
    setProjectLoading(true)
    try {
      const detail = await getProjectById(selectedProjectId)
      setProject(detail)
      setDeliverables((detail.deliverables ?? []) as Deliverable[])
    } catch (err) {
      setProject(null)
      setDeliverables([])
      toast.error(err instanceof Error ? err.message : "Impossible de charger ce projet.")
    } finally {
      setProjectLoading(false)
    }
  }, [selectedProjectId])

  useEffect(() => {
    loadProjects()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    loadProject()
  }, [loadProject])

  const stats = useMemo(() => {
    const allSubmissions = deliverables.flatMap((d) => d.submissions ?? [])
    return {
      total: deliverables.length,
      submissions: allSubmissions.length,
      late: allSubmissions.filter((s) => s.isLate).length,
      missing: Math.max(
        0,
        deliverables.reduce((sum, d) => sum + Math.max(0, (project?.groups?.length ?? 0) - (d.submissions?.length ?? 0)), 0),
      ),
      flagged: allSubmissions.filter((s) => (s.similarityScore ?? 0) >= 70).length,
    }
  }, [deliverables, project?.groups?.length])

  return (
    <MainLayout>
      <div className="p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Livrables</h1>
            <p className="text-muted-foreground">Suivez les rendus de vos projets par groupe</p>
          </div>
          <div className="flex items-center gap-3">
            {projects.length > 0 && (
              <Select value={selectedProjectId ?? undefined} onValueChange={setSelectedProjectId}>
                <SelectTrigger className="w-full sm:w-[260px]">
                  <SelectValue placeholder="Sélectionner un projet" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {project && (
              <Button onClick={() => router.push(`/projects/${project.id}`)}>
                Gérer le projet
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <CardsSkeleton count={3} />
        ) : error ? (
          <ErrorState message={error} onRetry={loadProjects} />
        ) : projects.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="Aucun projet pour le moment"
            description="Créez un projet, ses groupes et ses livrables pour suivre les rendus ici."
          />
        ) : (
          <>
            <div className="mb-6 grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Livrables</CardTitle>
                  <FileText aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.total}</div>
                  <p className="text-xs text-muted-foreground">Pour ce projet</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Soumissions</CardTitle>
                  <Users aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.submissions}</div>
                  <p className="text-xs text-muted-foreground">Rendus reçus</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">En retard</CardTitle>
                  <Clock aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">{stats.late}</div>
                  <p className="text-xs text-muted-foreground">Rendus après l'échéance</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Manquants</CardTitle>
                  <AlertTriangle aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.missing}</div>
                  <p className="text-xs text-muted-foreground">Rendus attendus non reçus</p>
                </CardContent>
              </Card>
            </div>

            {projectLoading ? (
              <CardsSkeleton count={2} />
            ) : deliverables.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="Aucun livrable défini pour ce projet"
                description="Créez des livrables depuis la page du projet pour suivre les rendus des groupes."
              />
            ) : (
              <div className="grid gap-6">
                {deliverables.map((deliverable) => {
                  const groupCount = project?.groups?.length ?? 0
                  const submissions = deliverable.submissions ?? []
                  const lateCount = submissions.filter((s) => s.isLate).length
                  const remaining = daysUntil(deliverable.deadline)
                  const isOverdue = remaining !== null && remaining < 0
                  const allIn = groupCount > 0 && submissions.length >= groupCount

                  return (
                    <Card key={deliverable.id} className={isOverdue && !allIn ? "border-destructive/60" : ""}>
                      <CardHeader>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="space-y-1">
                            <CardTitle className="flex items-center gap-2 text-xl">
                              <FileText aria-hidden="true" className="h-5 w-5" />
                              <span>{deliverable.name}</span>
                            </CardTitle>
                            <CardDescription className="flex flex-wrap items-center gap-2">
                              <span className="flex items-center gap-1">
                                <Calendar aria-hidden="true" className="h-3 w-3" />
                                <span>Échéance : {formatDateTime(deliverable.deadline)}</span>
                              </span>
                              {isOverdue && !allIn && <Badge variant="destructive">Échéance dépassée</Badge>}
                            </CardDescription>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={deliverable.type === "archive" ? "default" : "secondary"}>
                              {deliverable.type === "archive" ? "Archive" : "Lien Git"}
                            </Badge>
                            {allIn && (
                              <Badge variant="outline" className="flex items-center gap-1">
                                <CheckCircle aria-hidden="true" className="h-3 w-3" />
                                Complet
                              </Badge>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">{deliverable.description}</p>
                      </CardHeader>
                      <CardContent>
                        <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                          <div className="text-center">
                            <div className="text-lg font-bold">{submissions.length}/{groupCount}</div>
                            <div className="text-xs text-muted-foreground">Groupes ayant rendu</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{lateCount}</div>
                            <div className="text-xs text-muted-foreground">En retard</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-red-600 dark:text-red-400">
                              {Math.max(0, groupCount - submissions.length)}
                            </div>
                            <div className="text-xs text-muted-foreground">Non rendus</div>
                          </div>
                          <div className="text-center">
                            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                              {submissions.filter((s) => (s.similarityScore ?? 0) >= 70).length}
                            </div>
                            <div className="text-xs text-muted-foreground">Similarité élevée</div>
                          </div>
                        </div>

                        {submissions.length > 0 && (
                          <div className="space-y-2 rounded-lg border p-3">
                            {submissions.map((submission) => (
                              <div key={submission.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                <span className="font-medium">{submission.group?.name ?? `Groupe ${submission.groupId}`}</span>
                                <span className="flex flex-wrap items-center gap-2">
                                  <span className="text-muted-foreground">
                                    Rendu le {formatDateTime(submission.submittedAt)}
                                  </span>
                                  <Badge variant={submission.isLate ? "destructive" : "secondary"}>
                                    {submission.isLate ? "Retard" : "À l'heure"}
                                  </Badge>
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="mt-4">
                          <Button size="sm" onClick={() => router.push(`/projects/${project?.id}`)}>
                            Noter et gérer
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </MainLayout>
  )
}
