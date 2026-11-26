"use client"

import { projectPath } from "@/lib/routes"
import { MainLayout } from "@/components/layout/main-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { BookOpen, Calendar, Users, Clock, FolderOpen } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { fetchMyProjects, type Project } from "@/services/project.service"
import { ErrorState } from "@/components/shared/ErrorState"
import { EmptyState } from "@/components/shared/EmptyState"
import { CardsSkeleton } from "@/components/shared/Skeletons"
import { daysUntil, formatDateTime } from "@/lib/format"

export default function MyProjectsPage() {
  return (
    <ProtectedRoute roles={["student"]}>
      <MyProjectsPageContent />
    </ProtectedRoute>
  )
}

function MyProjectsPageContent() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchMyProjects()
      setProjects(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger vos projets.")
      setProjects([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <MainLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Mes projets</h1>
          <p className="text-muted-foreground">Suivez l’avancement de vos projets étudiants</p>
        </div>

        {loading ? (
          <CardsSkeleton count={2} />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : projects.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="Aucun projet pour le moment"
            description="Vos projets apparaîtront ici dès que votre enseignant en publiera un pour votre promotion."
          />
        ) : (
          <div className="grid gap-6">
            {projects.map((project) => {
              const remaining = daysUntil(project.groupFormationDeadline)
              const isUrgent = remaining !== null && remaining >= 0 && remaining <= 7
              const groupCount = project.groups?.length ?? 0

              return (
                <Card key={project.id} className={`transition-shadow hover:shadow-md ${isUrgent ? "border-destructive/60" : ""}`}>
                  <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <CardTitle className="flex items-center space-x-2 text-xl">
                          <BookOpen aria-hidden="true" className="h-5 w-5" />
                          <span>{project.name}</span>
                        </CardTitle>
                        <CardDescription className="flex flex-wrap items-center gap-2">
                          <span className="flex items-center gap-1">
                            <Users aria-hidden="true" className="h-3 w-3" />
                            <span>{groupCount > 0 ? `${groupCount} groupe(s) formé(s)` : "Groupes à former"}</span>
                          </span>
                          <span aria-hidden="true">•</span>
                          <span>{project.teacherName || "Enseignant"}</span>
                        </CardDescription>
                      </div>
                      <div className="flex items-center space-x-2">
                        {isUrgent && (
                          <Badge variant="destructive" className="flex items-center space-x-1">
                            <Clock aria-hidden="true" className="h-3 w-3" />
                            <span>Imminent</span>
                          </Badge>
                        )}
                        <Badge variant="secondary">{project.status === "visible" ? "En cours" : "Brouillon"}</Badge>
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{project.description}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                      <div className="flex items-center space-x-2">
                        <Calendar aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                        <span>
                          Constitution des groupes :{" "}
                          {project.groupFormationDeadline ? formatDateTime(project.groupFormationDeadline) : "non définie"}
                        </span>
                      </div>
                      {remaining !== null && remaining >= 0 && (
                        <span className={`font-medium ${isUrgent ? "text-destructive" : "text-muted-foreground"}`}>
                          {remaining > 0 ? `${remaining} jour${remaining > 1 ? "s" : ""} pour rejoindre un groupe` : "Dernier jour pour rejoindre un groupe"}
                        </span>
                      )}
                    </div>
                    <div className="mt-4">
                      <Button size="sm" onClick={() => router.push(projectPath("/my-projects", project.id))}>Voir détails</Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </MainLayout>
  )
}
