"use client"

import { useRouteProjectId } from "@/lib/routes"
import { BACKEND_URL, assertOk } from "@/lib/api"
import { MainLayout } from "@/components/layout/main-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Users, FileText, Upload, Calendar, CheckCircle, AlertCircle, ArrowLeft, Loader2 } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { getProjectById, type Project } from "@/services/project.service"
import { submitDeliverable } from "@/services/DeliverableService"
import { ValidationResults } from "@/components/student/ValidationResults"
import { StudentReportView } from "@/components/reports/StudentReportView"
import { ErrorState } from "@/components/shared/ErrorState"
import { EmptyState } from "@/components/shared/EmptyState"
import { DetailSkeleton } from "@/components/shared/Skeletons"
import { daysUntil, formatDateTime, formatFileSize, formatRelativeDay, formatDecimal } from "@/lib/format"
import { toast } from "sonner"

interface GroupDetailsPageProps {
  params: { id: string }
}

type GroupMember = { id: number; firstName: string; lastName: string; email: string; role?: string }
type Group = { id: number; name: string; members: GroupMember[] }
type ValidationRuleResult = { type: string; configuration?: string; passed: boolean; message: string }
type Submission = {
  id: number
  groupId: number
  fileName?: string | null
  fileSize?: number | null
  gitUrl?: string | null
  submittedAt: string
  isLate: boolean
}
type Deliverable = {
  id: number
  name: string
  description: string
  type: "archive" | "git_link"
  deadline: string
  allowLateSubmission: boolean
  penaltyPerHour: number
  submissions?: Submission[]
}

export function GroupDetailsPageContent({ params }: GroupDetailsPageProps) {
  const projectId = useRouteProjectId(params.id)
  const [project, setProject] = useState<Project | null>(null)
  const [group, setGroup] = useState<Group | null>(null)
  const [deliverables, setDeliverables] = useState<Deliverable[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentStudentId, setCurrentStudentId] = useState<number | null>(null)

  const [selectedDeliverable, setSelectedDeliverable] = useState<number | null>(null)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [gitUrl, setGitUrl] = useState("")
  const [validationResults, setValidationResults] = useState<ValidationRuleResult[]>([])
  const [isValidating, setIsValidating] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const projectData = await getProjectById(projectId)
      const groupList = (projectData.groups ?? []) as Group[]
      const myGroup =
        groupList.find((g) => Array.isArray(g.members) && g.members.some((m) => m.id === currentStudentId)) ?? null
      setProject(projectData)
      setGroup(myGroup)
      setDeliverables((projectData.deliverables ?? []) as Deliverable[])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger ce projet.")
    } finally {
      setLoading(false)
    }
  }, [projectId, currentStudentId])

  useEffect(() => {
    const stored = window.localStorage.getItem("user")
    if (stored) {
      try {
        setCurrentStudentId(Number(JSON.parse(stored)?.id) || null)
      } catch {
        // utilisateur stocké illisible
      }
    }
  }, [])

  useEffect(() => {
    if (currentStudentId !== null) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStudentId])

  const validateBeforeSubmit = async (deliverableId: number, file: File | null, url: string | null) => {
    setIsValidating(true)
    setValidationResults([])

    try {
      const token = window.localStorage.getItem("token")
      if (!token) throw new Error("Session expirée")

      const formData = new FormData()
      if (file) formData.append("file", file)
      else if (url) formData.append("gitUrl", url)
      if (group) formData.append("groupId", String(group.id))

      const response = await fetch(`${BACKEND_URL}/api/deliverables/${deliverableId}/validate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      await assertOk(response)

      const results = await response.json()
      setValidationResults(results.rules ?? [])
      return results.allPassed ?? false
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la validation du livrable.")
      setValidationResults([])
      return false
    } finally {
      setIsValidating(false)
    }
  }

  const closeDialog = () => {
    setSelectedDeliverable(null)
    setValidationResults([])
    setUploadFile(null)
    setGitUrl("")
  }

  const handleSubmit = async (deliverable: Deliverable) => {
    if (!group) return
    setIsSubmitting(true)
    try {
      await submitDeliverable(deliverable.id, {
        groupId: group.id,
        file: deliverable.type === "archive" ? uploadFile : null,
        gitUrl: deliverable.type === "git_link" ? gitUrl : undefined,
      })
      toast.success("Livrable rendu.")
      closeDialog()
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Le rendu n’a pas pu être envoyé.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const getDeadlineStatus = (deadline: string) => {
    const days = daysUntil(deadline) ?? 0
    if (days < 0) {
      return { variant: "destructive" as const, text: "Échéance dépassée", icon: AlertCircle }
    } else if (days <= 3) {
      return {
        variant: "default" as const,
        text: `${days} jour${days !== 1 ? "s" : ""} restant${days !== 1 ? "s" : ""}`,
        icon: AlertCircle,
      }
    }
    return { variant: "secondary" as const, text: `${days} jours restants`, icon: Calendar }
  }

  if (loading && !project) {
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
          <ErrorState message={error ?? "Projet introuvable."} onRetry={load} />
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="p-6">
        <div className="mb-6">
          <Button variant="ghost" size="sm" className="mb-4" onClick={() => window.history.length > 1 ? window.history.back() : undefined}>
            <ArrowLeft aria-hidden="true" className="mr-2 h-4 w-4" />
            Retour au projet
          </Button>
          <h1 className="text-3xl font-bold text-foreground">{project.name}</h1>
          <p className="mt-2 text-muted-foreground">{project.description}</p>
        </div>

        {!group ? (
          <EmptyState
            icon={Users}
            title="Vous n’êtes pas encore dans un groupe pour ce projet"
            description="Rejoignez un groupe depuis la page du projet pour accéder à cet espace."
          />
        ) : (
          <>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  <Users aria-hidden="true" className="h-5 w-5" />
                  {group.name}
                </CardTitle>
                <CardDescription>Membres de votre groupe</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-3">
                  {group.members?.map((member) => (
                    <div key={member.id} className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-medium">
                        {member.firstName?.charAt(0) ?? "?"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {member.firstName} {member.lastName}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="deliverables" className="space-y-4">
              <TabsList>
                <TabsTrigger value="deliverables">Livrables</TabsTrigger>
                <TabsTrigger value="reports">Rapport</TabsTrigger>
              </TabsList>

              <TabsContent value="deliverables" className="space-y-4">
                {deliverables.length === 0 ? (
                  <EmptyState
                    icon={FileText}
                    title="Aucun livrable pour ce projet"
                    description="Votre enseignant n’a pas encore défini de livrable à rendre."
                  />
                ) : (
                  deliverables.map((deliverable) => {
                    const deadlineStatus = getDeadlineStatus(deliverable.deadline)
                    const DeadlineIcon = deadlineStatus.icon
                    const submission =
                      deliverable.submissions?.find((sub) => sub.groupId === group.id) ?? null
                    const hasSubmitted = submission !== null

                    return (
                      <Card key={deliverable.id}>
                        <CardHeader>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex-1">
                              <CardTitle className="text-lg">{deliverable.name}</CardTitle>
                              <CardDescription className="mt-1">{deliverable.description}</CardDescription>
                            </div>
                            <Badge variant={hasSubmitted ? (submission!.isLate ? "destructive" : "default") : "secondary"}>
                              {hasSubmitted ? (submission!.isLate ? "Rendu en retard" : "Rendu") : "À rendre"}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="flex flex-wrap items-center gap-4 text-sm">
                            <div className="flex flex-wrap items-center gap-2">
                              <DeadlineIcon aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground">Échéance :</span>
                              <span className="font-medium">{formatDateTime(deliverable.deadline)}</span>
                              <Badge variant={deadlineStatus.variant}>{deadlineStatus.text}</Badge>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <FileText aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground">Type :</span>
                              <Badge variant="outline">
                                {deliverable.type === "archive" ? "Archive (.zip, .pdf)" : "Lien Git"}
                              </Badge>
                            </div>
                          </div>

                          {hasSubmitted ? (
                            <div className="rounded-lg border bg-muted/50 p-4">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="space-y-1">
                                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                                    <CheckCircle aria-hidden="true" className="h-4 w-4 text-green-600" />
                                    Rendu enregistré
                                  </p>
                                  {deliverable.type === "archive" && submission!.fileName && (
                                    <p className="text-sm text-muted-foreground">
                                      Fichier : {submission!.fileName} ({submission!.fileSize ? formatFileSize(submission!.fileSize) : "—"})
                                    </p>
                                  )}
                                  {deliverable.type === "git_link" && submission!.gitUrl && (
                                    <p className="text-sm text-muted-foreground">
                                      Lien :{" "}
                                      <a
                                        href={submission!.gitUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary hover:underline"
                                      >
                                        {submission!.gitUrl}
                                      </a>
                                    </p>
                                  )}
                                  <p className="text-xs text-muted-foreground">
                                    Rendu le {formatDateTime(submission!.submittedAt)} ({formatRelativeDay(submission!.submittedAt)})
                                  </p>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <Dialog open={selectedDeliverable === deliverable.id} onOpenChange={(open) => { if (!open) closeDialog() }}>
                              <DialogTrigger asChild>
                                <Button onClick={() => setSelectedDeliverable(deliverable.id)}>
                                  <Upload aria-hidden="true" className="mr-2 h-4 w-4" />
                                  Rendre le livrable
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-2xl">
                                <DialogHeader>
                                  <DialogTitle>Rendre « {deliverable.name} »</DialogTitle>
                                  <DialogDescription>{deliverable.description}</DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                  {deliverable.type === "archive" ? (
                                    <div className="space-y-2">
                                      <Label htmlFor={`file-${deliverable.id}`}>Fichier (.zip, .pdf)</Label>
                                      <Input
                                        id={`file-${deliverable.id}`}
                                        type="file"
                                        accept=".zip,.pdf"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0] ?? null
                                          setUploadFile(file)
                                          if (file) {
                                            validateBeforeSubmit(deliverable.id, file, null)
                                          }
                                        }}
                                      />
                                      {uploadFile && (
                                        <p className="text-sm text-muted-foreground">
                                          Fichier sélectionné : {uploadFile.name} ({formatFileSize(uploadFile.size)})
                                        </p>
                                      )}
                                    </div>
                                  ) : (
                                    <div className="space-y-2">
                                      <Label htmlFor={`git-url-${deliverable.id}`}>Lien Git</Label>
                                      <Input
                                        id={`git-url-${deliverable.id}`}
                                        type="url"
                                        placeholder="https://github.com/…"
                                        value={gitUrl}
                                        onChange={(e) => setGitUrl(e.target.value)}
                                        onBlur={() => {
                                          if (gitUrl) {
                                            validateBeforeSubmit(deliverable.id, null, gitUrl)
                                          }
                                        }}
                                      />
                                    </div>
                                  )}

                                  {(validationResults.length > 0 || isValidating) && (
                                    <ValidationResults rules={validationResults} isValidating={isValidating} />
                                  )}

                                  <Alert>
                                    <AlertCircle aria-hidden="true" className="h-4 w-4" />
                                    <AlertDescription>
                                      {deliverable.allowLateSubmission
                                        ? `Rendu en retard accepté, avec un malus de ${formatDecimal(deliverable.penaltyPerHour)} pt par heure de retard.`
                                        : "Aucun rendu n’est accepté après la date limite."}
                                    </AlertDescription>
                                  </Alert>
                                </div>
                                <DialogFooter>
                                  <Button variant="outline" onClick={closeDialog}>
                                    Annuler
                                  </Button>
                                  <Button
                                    onClick={() => handleSubmit(deliverable)}
                                    disabled={
                                      isSubmitting ||
                                      isValidating ||
                                      (deliverable.type === "archive" && !uploadFile) ||
                                      (deliverable.type === "git_link" && !gitUrl) ||
                                      (validationResults.length > 0 && !validationResults.every((r) => r.passed))
                                    }
                                  >
                                    {isSubmitting ? (
                                      <>
                                        <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
                                        Envoi…
                                      </>
                                    ) : isValidating ? (
                                      <>
                                        <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
                                        Validation…
                                      </>
                                    ) : (
                                      <>
                                        <Upload aria-hidden="true" className="mr-2 h-4 w-4" />
                                        Rendre
                                      </>
                                    )}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          )}
                        </CardContent>
                      </Card>
                    )
                  })
                )}
              </TabsContent>

              <TabsContent value="reports" className="space-y-4">
                <StudentReportView projectId={Number(projectId)} groupId={group.id} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </MainLayout>
  )
}
