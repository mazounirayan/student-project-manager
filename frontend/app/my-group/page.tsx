"use client"

import { MainLayout } from "@/components/layout/main-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Users, Calendar, ArrowLeft } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { fetchMyProjects, getProjectById, type Project } from "@/services/project.service"
import { ErrorState } from "@/components/shared/ErrorState"
import { EmptyState } from "@/components/shared/EmptyState"
import { DetailSkeleton } from "@/components/shared/Skeletons"
import { formatDateLong } from "@/lib/date"

type Member = { id: number; firstName: string; lastName: string; email: string }
type Group = { id: number; name: string; members: Member[] }

export default function MyGroupPage() {
  return (
    <ProtectedRoute roles={["student"]}>
      <MyGroupPageContent />
    </ProtectedRoute>
  )
}

function MyGroupPageContent() {
  const [project, setProject] = useState<Project | null>(null)
  const [group, setGroup] = useState<Group | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const userRaw = window.localStorage.getItem("user")
      const myId = userRaw ? Number(JSON.parse(userRaw)?.id) : null

      const projects: Project[] = await fetchMyProjects()
      for (const candidate of projects) {
        const detail = await getProjectById(candidate.id)
        const myGroup = ((detail.groups ?? []) as Group[]).find(
          (g) => Array.isArray(g.members) && g.members.some((m) => m.id === myId)
        )
        if (myGroup) {
          setProject(detail)
          setGroup(myGroup)
          return
        }
      }
      // Aucun groupe rejoint parmi les projets visibles
      setProject(null)
      setGroup(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger votre groupe.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <MainLayout>
        <div className="p-6">
          <DetailSkeleton />
        </div>
      </MainLayout>
    )
  }

  return (
    <MainLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Mon groupe</h1>
          <p className="text-muted-foreground">Collaborez avec les membres de votre équipe</p>
        </div>

        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : !group || !project ? (
          <EmptyState
            icon={Users}
            title="Vous n'êtes pas encore dans un groupe"
            description="Rejoignez un groupe depuis la page d'un projet pour retrouver ici vos coéquipiers et vos livrables."
            action={
              <Button onClick={() => router.push("/my-projects")}>Voir mes projets</Button>
            }
          />
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users aria-hidden="true" className="h-5 w-5" />
                    <span>{group.name}</span>
                  </CardTitle>
                  <CardDescription>
                    {project.name} • {group.members.length}/{project.maxGroupSize} membres
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {group.members?.map((member) => (
                      <div key={member.id} className="flex items-center gap-4 rounded-lg border p-4">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback>
                            {member.firstName?.[0]}
                            {member.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-medium">
                            {member.firstName} {member.lastName}
                          </h3>
                          <p className="truncate text-sm text-muted-foreground">{member.email}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Informations du projet</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="mb-1 text-sm font-medium">Projet</h4>
                    <p className="text-sm text-muted-foreground">{project.name}</p>
                  </div>
                  <div>
                    <h4 className="mb-1 text-sm font-medium">Enseignant</h4>
                    <p className="text-sm text-muted-foreground">{project.teacherName || "—"}</p>
                  </div>
                  <div>
                    <h4 className="mb-1 flex items-center gap-1 text-sm font-medium">
                      <Calendar aria-hidden="true" className="h-4 w-4" />
                      Constitution des groupes
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {project.groupFormationDeadline ? formatDateLong(project.groupFormationDeadline) : "Non définie"}
                    </p>
                  </div>
                  <div className="flex items-center justify-between border-t pt-3">
                    <span className="text-sm text-muted-foreground">Membres</span>
                    <Badge variant="outline">
                      {group.members.length} / {project.maxGroupSize}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Actions rapides</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => router.push(`/my-projects/${project.id}/group`)}
                  >
                    <Users aria-hidden="true" className="mr-2 h-4 w-4" />
                    Espace du groupe (livrables, rapport)
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => router.push(`/my-projects/${project.id}`)}
                  >
                    <ArrowLeft aria-hidden="true" className="mr-2 h-4 w-4" />
                    Page du projet
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  )
}
