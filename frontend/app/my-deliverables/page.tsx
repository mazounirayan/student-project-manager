"use client"

import { projectPath } from "@/lib/routes"
import { MainLayout } from "@/components/layout/main-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { FileText, Calendar, CheckCircle, Clock, AlertCircle, FolderOpen } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { fetchMyProjects, getProjectById, type Project } from "@/services/project.service"
import { ErrorState } from "@/components/shared/ErrorState"
import { EmptyState } from "@/components/shared/EmptyState"
import { CardsSkeleton } from "@/components/shared/Skeletons"
import { daysUntil, formatDateTime, formatRelativeDay } from "@/lib/format"
import { SubmitDeliverableDialog } from "@/components/deliverables/submit-deliverable-dialog"
import { useRouter } from "next/navigation"

type Submission = {
  id: number
  groupId: number
  fileName?: string | null
  gitUrl?: string | null
  submittedAt: string
  isLate: boolean
  validationResults?: Array<{ type: string; passed: boolean; message: string }>
}
type Deliverable = {
  id: number
  name: string
  description: string
  type: "archive" | "git_link"
  deadline: string
  submissions?: Submission[]
}
type MyDeliverable = Deliverable & { projectId: number; projectName: string; groupId: number | null; submission: Submission | null }

export default function MyDeliverablesPage() {
  return (
    <ProtectedRoute roles={["student"]}>
      <MyDeliverablesPageContent />
    </ProtectedRoute>
  )
}

function MyDeliverablesPageContent() {
  const [deliverables, setDeliverables] = useState<MyDeliverable[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const router = useRouter()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const userRaw = window.localStorage.getItem("user")
      const myId = userRaw ? Number(JSON.parse(userRaw)?.id) : null

      const projects: Project[] = await fetchMyProjects()
      const results: MyDeliverable[] = []

      for (const project of projects) {
        try {
          const detail = await getProjectById(project.id)
          const group = ((detail.groups ?? []) as Array<{ id: number; members?: Array<{ id: number }> }>).find((g) =>
            Array.isArray(g.members) && g.members.some((m) => m.id === myId)
          )
          for (const deliverable of (detail.deliverables ?? []) as Deliverable[]) {
            const submission =
              (deliverable.submissions ?? []).find((s) => s.groupId === group?.id) ?? null
            results.push({
              ...deliverable,
              projectId: project.id,
              projectName: project.name,
              groupId: group?.id ?? null,
              submission,
            })
          }
        } catch {
          // Un projet illisible ne doit pas bloquer la vue d’ensemble.
        }
      }

      results.sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())
      setDeliverables(results)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger vos livrables.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load, reloadKey])

  const pending = deliverables.filter((d) => !d.submission)
  const submitted = deliverables.filter((d) => d.submission)

  const getStatusBadge = (deliverable: MyDeliverable) => {
    if (deliverable.submission) {
      return deliverable.submission.isLate ? (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertCircle aria-hidden="true" className="h-3 w-3" />
          <span>Rendu en retard</span>
        </Badge>
      ) : (
        <Badge variant="default" className="flex items-center gap-1">
          <CheckCircle aria-hidden="true" className="h-3 w-3" />
          <span>Rendu</span>
        </Badge>
      )
    }
    const remaining = daysUntil(deliverable.deadline)
    if (remaining !== null && remaining < 0) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertCircle aria-hidden="true" className="h-3 w-3" />
          <span>En retard</span>
        </Badge>
      )
    }
    return (
      <Badge variant="secondary" className="flex items-center gap-1">
        <Clock aria-hidden="true" className="h-3 w-3" />
        <span>À rendre</span>
      </Badge>
    )
  }

  return (
    <MainLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Mes livrables</h1>
          <p className="text-muted-foreground">Ce que votre groupe doit rendre et ce qu’il a déjà rendu.</p>
        </div>

        {loading ? (
          <CardsSkeleton count={3} />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : deliverables.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="Aucun livrable pour le moment"
            description="Les livrables de vos projets apparaîtront ici dès qu’un enseignant en aura défini."
          />
        ) : (
          <>
            <div className="mb-6 grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-wrap flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">À rendre</CardTitle>
                  <Clock aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{pending.length}</div>
                  <p className="text-xs text-muted-foreground">Livrables en attente</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-wrap flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Rendus</CardTitle>
                  <CheckCircle aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{submitted.length}</div>
                  <p className="text-xs text-muted-foreground">Livrables rendus</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-wrap flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Ponctualité</CardTitle>
                  <FileText aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {submitted.length > 0
                      ? `${Math.round(((submitted.length - submitted.filter((d) => d.submission!.isLate).length) / submitted.length) * 100)} %`
                      : "—"}
                  </div>
                  <p className="text-xs text-muted-foreground">Rendus à l’heure</p>
                </CardContent>
              </Card>
            </div>

            {pending.length > 0 && (
              <div className="mb-8">
                <h2 className="mb-4 text-xl font-semibold">À rendre</h2>
                <div className="grid gap-4">
                  {pending.map((deliverable) => {
                    const remaining = daysUntil(deliverable.deadline)
                    const isUrgent = remaining !== null && remaining <= 3

                    return (
                      <Card key={`${deliverable.projectId}-${deliverable.id}`} className={isUrgent ? "border-destructive" : ""}>
                        <CardHeader>
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="space-y-1">
                              <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                                <FileText aria-hidden="true" className="h-5 w-5" />
                                <span>{deliverable.name}</span>
                              </CardTitle>
                              <CardDescription>{deliverable.projectName}</CardDescription>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              {getStatusBadge(deliverable)}
                              {isUrgent && <Badge variant="destructive">Urgent</Badge>}
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground">{deliverable.description}</p>
                        </CardHeader>
                        <CardContent>
                          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Calendar aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">Échéance : {formatDateTime(deliverable.deadline)}</span>
                            </div>
                            <span className={`text-sm font-medium ${isUrgent ? "text-destructive" : "text-muted-foreground"}`}>
                              {remaining !== null && remaining >= 0
                                ? formatRelativeDay(deliverable.deadline)
                                : "échéance dépassée"}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {deliverable.groupId ? (
                              <SubmitDeliverableDialog
                                deliverableId={deliverable.id}
                                groupId={deliverable.groupId}
                                onSubmitted={() => setReloadKey((k) => k + 1)}
                              />
                            ) : (
                              <Button variant="outline" onClick={() => router.push(projectPath("/my-projects", deliverable.projectId))}>
                                Rejoindre d’abord un groupe
                              </Button>
                            )}
                            <Button variant="outline" onClick={() => router.push(projectPath("/my-projects", deliverable.projectId, "/group"))}>
                              Voir le projet
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })}
                </div>
              </div>
            )}

            <div>
              <h2 className="mb-4 text-xl font-semibold">Historique</h2>
              {submitted.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="Aucun livrable rendu pour l’instant"
                  description="Vos rendus apparaîtront ici."
                />
              ) : (
                <div className="grid gap-4">
                  {submitted.map((deliverable) => (
                    <Card key={`${deliverable.projectId}-${deliverable.id}`}>
                      <CardHeader>
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="space-y-1">
                            <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                              <FileText aria-hidden="true" className="h-5 w-5" />
                              <span>{deliverable.name}</span>
                            </CardTitle>
                            <CardDescription>{deliverable.projectName}</CardDescription>
                          </div>
                          {getStatusBadge(deliverable)}
                        </div>
                        <p className="text-sm text-muted-foreground">{deliverable.description}</p>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                          <div className="flex flex-wrap items-center gap-2">
                            <Calendar aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                            <span>Échéance : {formatDateTime(deliverable.deadline)}</span>
                          </div>
                          <span className="text-muted-foreground">
                            Rendu le {formatDateTime(deliverable.submission!.submittedAt)}
                          </span>
                        </div>

                        {deliverable.type === "archive" && deliverable.submission!.fileName && (
                          <p className="text-sm text-muted-foreground">Fichier : {deliverable.submission!.fileName}</p>
                        )}
                        {deliverable.type === "git_link" && deliverable.submission!.gitUrl && (
                          <p className="text-sm text-muted-foreground">
                            Lien :{" "}
                            <a
                              href={deliverable.submission!.gitUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline"
                            >
                              {deliverable.submission!.gitUrl}
                            </a>
                          </p>
                        )}

                        {deliverable.submission!.validationResults &&
                          deliverable.submission!.validationResults.length > 0 && (
                            <Progress
                              value={
                                (deliverable.submission!.validationResults.filter((r) => r.passed).length /
                                  deliverable.submission!.validationResults.length) *
                                100
                              }
                              className="h-2"
                              aria-label="Règles respectées"
                            />
                          )}

                        <div>
                          <Button variant="outline" size="sm" onClick={() => router.push(projectPath("/my-projects", deliverable.projectId, "/group"))}>
                            Voir le projet
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </MainLayout>
  )
}
