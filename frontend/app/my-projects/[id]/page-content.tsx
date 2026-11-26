"use client"

import { projectPath, useRouteProjectId } from "@/lib/routes"
import { MainLayout } from "@/components/layout/main-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Users, Calendar, AlertCircle, CheckCircle, UserPlus, ArrowLeft, Loader2 } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { getProjectById, type Project } from "@/services/project.service"
import { joinGroup } from "@/services/groups.service"
import { useRouter } from "next/navigation"
import { ErrorState } from "@/components/shared/ErrorState"
import { EmptyState } from "@/components/shared/EmptyState"
import { DetailSkeleton } from "@/components/shared/Skeletons"
import { daysUntil, formatDateLong } from "@/lib/format"
import { toast } from "sonner"

interface ProjectDetailsPageProps {
  params: { id: string }
}

type GroupMember = { id: number; firstName: string; lastName: string; email: string }
type Group = { id: number; name: string; members: GroupMember[] }

export function StudentProjectDetailsPageContent({ params }: ProjectDetailsPageProps) {
  const projectId = useRouteProjectId(params.id)
  const [currentStudentId, setCurrentStudentId] = useState<number | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [groups, setGroups] = useState<Group[]>([])
  const [currentGroupId, setCurrentGroupId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [joining, setJoining] = useState<number | null>(null)
  const router = useRouter()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const projectData = await getProjectById(projectId)
      const groupList = (projectData.groups ?? []) as Group[]
      const myGroup = groupList.find((g) =>
        Array.isArray(g.members) && g.members.some((m) => m.id === currentStudentId)
      )
      setProject(projectData)
      setGroups(groupList)
      setCurrentGroupId(myGroup?.id ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger ce projet.")
    } finally {
      setLoading(false)
    }
  }, [projectId, currentStudentId])

  useEffect(() => {
    const user = window.localStorage.getItem("user")
    if (user) {
      try {
        const userData = JSON.parse(user)
        if (userData && userData.id) setCurrentStudentId(Number(userData.id))
      } catch {
        // utilisateur stocké illisible : considéré non identifié
      }
    }
  }, [])

  useEffect(() => {
    if (currentStudentId !== null) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStudentId])

  const deadline = project?.groupFormationDeadline ? new Date(project.groupFormationDeadline) : null
  const remaining = daysUntil(project?.groupFormationDeadline)
  const isDeadlinePassed = deadline ? new Date() > deadline : false

  const handleJoinGroup = async (groupId: number) => {
    setJoining(groupId)
    try {
      await joinGroup(groupId)
      toast.success("Vous avez rejoint le groupe.")
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Impossible de rejoindre ce groupe.")
    } finally {
      setJoining(null)
    }
  }

  const canJoinGroup = (group: Group) => {
    if (currentGroupId !== null) return false
    if (isDeadlinePassed) return false
    if (group.members.length >= (project?.maxGroupSize ?? 4)) return false
    return true
  }

  const getGroupStatus = (group: Group) => {
    const memberCount = group.members.length
    if (memberCount === 0) {
      return <Badge variant="secondary">Vide</Badge>
    } else if (memberCount < (project?.minGroupSize ?? 2)) {
      return <Badge variant="secondary">Incomplet ({memberCount}/{project?.minGroupSize})</Badge>
    } else if (memberCount < (project?.maxGroupSize ?? 4)) {
      return <Badge variant="default">Disponible ({memberCount}/{project?.maxGroupSize})</Badge>
    } else {
      return <Badge variant="outline">Complet ({memberCount}/{project?.maxGroupSize})</Badge>
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
          <div className="mb-6">
            <Button variant="ghost" size="sm" onClick={() => router.push("/my-projects")}>
              <ArrowLeft aria-hidden="true" className="mr-2 h-4 w-4" />
              Retour à mes projets
            </Button>
          </div>
          <ErrorState message={error ?? "Projet introuvable."} onRetry={load} />
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="p-6">
        <div className="mb-6">
          <Button variant="ghost" size="sm" className="mb-4" onClick={() => router.push("/my-projects")}>
            <ArrowLeft aria-hidden="true" className="mr-2 h-4 w-4" />
            Retour à mes projets
          </Button>
          <h1 className="text-3xl font-bold text-foreground">{project.name}</h1>
          <p className="mt-2 text-muted-foreground">{project.description}</p>
        </div>

        {!isDeadlinePassed && remaining !== null && remaining <= 7 && (
          <Alert className="mb-6 border-orange-500 bg-orange-50 dark:bg-orange-950/20">
            <AlertCircle aria-hidden="true" className="h-4 w-4 text-orange-600" />
            <AlertDescription className="text-orange-800 dark:text-orange-200">
              <strong>Attention :</strong> il vous reste {remaining} jour{remaining !== 1 ? "s" : ""} pour rejoindre un groupe avant la date limite.
            </AlertDescription>
          </Alert>
        )}

        {isDeadlinePassed && (
          <Alert className="mb-6 border-red-500 bg-red-50 dark:bg-red-950/20">
            <AlertCircle aria-hidden="true" className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800 dark:text-red-200">
              <strong>Date limite dépassée :</strong> vous ne pouvez plus rejoindre ou quitter un groupe.
            </AlertDescription>
          </Alert>
        )}

        <div className="mb-6 grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                <Users aria-hidden="true" className="h-5 w-5" />
                Règles de formation des groupes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center justify-between">
                <span className="text-sm text-muted-foreground">Taille minimale</span>
                <Badge variant="outline">{project.minGroupSize} étudiants</Badge>
              </div>
              <div className="flex flex-wrap items-center justify-between">
                <span className="text-sm text-muted-foreground">Taille maximale</span>
                <Badge variant="outline">{project.maxGroupSize} étudiants</Badge>
              </div>
              <div className="flex flex-wrap items-center justify-between">
                <span className="text-sm text-muted-foreground">Mode de formation</span>
                <Badge variant="default">
                  {project.groupFormationRule === "free" ? "Libre" : project.groupFormationRule === "manual" ? "Manuel (enseignant)" : "Aléatoire"}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center justify-between border-t pt-2">
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Calendar aria-hidden="true" className="h-4 w-4" />
                  Date limite
                </span>
                <span className="text-sm font-medium">
                  {deadline ? formatDateLong(deadline) : "Non définie"}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2">
                <CheckCircle aria-hidden="true" className="h-5 w-5" />
                Votre statut
              </CardTitle>
            </CardHeader>
            <CardContent>
              {currentGroupId !== null ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between">
                    <span className="text-sm text-muted-foreground">Groupe actuel</span>
                    <Badge variant="default">{groups.find((g) => g.id === currentGroupId)?.name}</Badge>
                  </div>
                  <div className="flex flex-wrap items-center justify-between">
                    <span className="text-sm text-muted-foreground">Membres</span>
                    <span className="text-sm font-medium">
                      {groups.find((g) => g.id === currentGroupId)?.members.length ?? 0} / {project.maxGroupSize}
                    </span>
                  </div>
                  <Button
                    variant="default"
                    className="w-full mt-4"
                    onClick={() => router.push(projectPath("/my-projects", projectId, "/group"))}
                  >
                    Accéder à l’espace de mon groupe
                  </Button>
                </div>
              ) : (
                <div className="py-4 text-center">
                  <AlertCircle aria-hidden="true" className="mx-auto mb-2 h-12 w-12 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Vous n’êtes pas encore dans un groupe</p>
                  {!isDeadlinePassed && project.groupFormationRule === "free" && (
                    <p className="mt-1 text-xs text-muted-foreground">Rejoignez un groupe ci-dessous</p>
                  )}
                  {!isDeadlinePassed && project.groupFormationRule !== "free" && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Votre enseignant constituera les groupes. Revenez vérifier cette page plus tard.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Groupes</CardTitle>
            <CardDescription>{groups.length} groupe(s) pour ce projet</CardDescription>
          </CardHeader>
          <CardContent>
            {groups.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Aucun groupe n’a encore été formé"
                description="Les groupes apparaîtront ici dès que votre enseignant les aura constitués."
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {groups.map((group) => {
                  const isMyGroup = currentGroupId === group.id
                  const canJoin = canJoinGroup(group)

                  return (
                    <Card key={group.id} className={`transition-shadow hover:shadow-md ${isMyGroup ? "border-primary bg-primary/5" : ""}`}>
                      <CardHeader>
                        <div className="flex flex-wrap items-center justify-between">
                          <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                            <Users aria-hidden="true" className="h-4 w-4" />
                            {group.name}
                          </CardTitle>
                          {getGroupStatus(group)}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div>
                            <p className="mb-2 text-sm text-muted-foreground">
                              Membres ({group.members.length}/{project.maxGroupSize})
                            </p>
                            {group.members.length > 0 ? (
                              <div className="space-y-1">
                                {group.members.map((member) => (
                                  <div key={member.id} className="flex flex-wrap items-center gap-2 text-sm">
                                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium">
                                      {member.firstName?.charAt(0)}
                                    </div>
                                    <span>{member.firstName} {member.lastName}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm italic text-muted-foreground">Aucun membre</p>
                            )}
                          </div>

                          {isMyGroup ? (
                            <Badge variant="default" className="w-full justify-center">
                              <CheckCircle aria-hidden="true" className="mr-2 h-3 w-3" />
                              Votre groupe
                            </Badge>
                          ) : canJoin ? (
                            <Button className="w-full" disabled={joining === group.id} onClick={() => handleJoinGroup(group.id)}>
                              {joining === group.id ? (
                                <>
                                  <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
                                  Inscription…
                                </>
                              ) : (
                                <>
                                  <UserPlus aria-hidden="true" className="mr-2 h-4 w-4" />
                                  Rejoindre
                                </>
                              )}
                            </Button>
                          ) : (
                            <Button className="w-full" disabled>
                              {group.members.length >= (project.maxGroupSize ?? 4) ? "Complet" : "Non disponible"}
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  )
}
