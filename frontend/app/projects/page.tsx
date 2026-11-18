"use client"

import { MainLayout } from "@/components/layout/main-layout"
import { CreateProjectDialog } from "@/components/projects/create-project-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Search, FolderOpen, Users, FileText, Calendar, MoreHorizontal } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { EditProjectDialog } from "@/components/projects/edit-project-dialog"
import { useToast } from "@/components/ui/use-toast"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { createProject, deleteProject, fetchMyProjects, type Project } from "@/services/project.service"
import { promotionService, type Promotion } from "@/services/PromotionService"
import { ConfirmDialog } from "@/components/ui/ConfirmDialog"
import { ErrorState } from "@/components/shared/ErrorState"
import { EmptyState } from "@/components/shared/EmptyState"
import { CardsSkeleton } from "@/components/shared/Skeletons"
import { formatDate } from "@/lib/date"

export default function ProjectsPage() {
  return (
    <ProtectedRoute roles={["teacher"]}>
      <ProjectsPageContent />
    </ProtectedRoute>
  )
}

function ProjectsPageContent() {
  const [projects, setProjects] = useState<Project[]>([])
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Project | null>(null)
  const { toast } = useToast()

  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [promotionFilter, setPromotionFilter] = useState("all")

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [projectsData, promotionsData] = await Promise.all([
        fetchMyProjects(),
        promotionService.getAll().catch(() => [] as Promotion[]),
      ])
      setProjects(Array.isArray(projectsData) ? projectsData : [])
      setPromotions(Array.isArray(promotionsData) ? promotionsData : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les projets.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const getStatusBadge = (status: Project["status"]) => {
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

  const handleProjectCreated = async (newProject: Project) => {
    try {
      const created = await createProject(newProject as never)
      setProjects((prev) => [created, ...prev])
      toast({
        title: "Projet créé",
        description: `Le projet « ${created.name} » a été ajouté avec succès.`,
      })
    } catch (err) {
      toast({
        title: "Erreur lors de la création",
        description: err instanceof Error ? err.message : "Impossible de créer le projet. Réessayez plus tard.",
        variant: "destructive",
      })
    }
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    const target = pendingDelete
    try {
      await deleteProject(target.id)
      setProjects((prev) => prev.filter((p) => p.id !== target.id))
      toast({
        title: "Projet supprimé",
        description: `Le projet « ${target.name} » a été supprimé.`,
      })
    } catch (err) {
      toast({
        title: "Erreur de suppression",
        description: err instanceof Error ? err.message : "Impossible de supprimer ce projet.",
        variant: "destructive",
      })
    } finally {
      setPendingDelete(null)
    }
  }

  const filteredProjects = projects?.filter((project) => {
    const matchesSearch =
      project.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.description?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesStatus = statusFilter === "all" || project.status === statusFilter
    const matchesPromotion =
      promotionFilter === "all" || project.promotionId?.toString() === promotionFilter
    return matchesSearch && matchesStatus && matchesPromotion
  })

  const hasFilters = searchQuery !== "" || statusFilter !== "all" || promotionFilter !== "all"

  return (
    <MainLayout>
      <div className="p-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Projets</h1>
            <p className="text-muted-foreground">Gérez vos projets étudiants</p>
          </div>
          <CreateProjectDialog onProjectCreated={handleProjectCreated} promotions={promotions} />
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <Search aria-hidden="true" className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un projet…"
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="draft">Brouillon</SelectItem>
              <SelectItem value="visible">Visible</SelectItem>
              <SelectItem value="completed">Terminé</SelectItem>
            </SelectContent>
          </Select>
          <Select value={promotionFilter} onValueChange={setPromotionFilter}>
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue placeholder="Promotion" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les promotions</SelectItem>
              {promotions?.map((promo) => (
                <SelectItem key={promo.id} value={promo.id.toString()}>
                  {promo.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <CardsSkeleton count={3} />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : filteredProjects?.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title={hasFilters ? "Aucun projet ne correspond à vos critères de recherche" : "Aucun projet pour le moment"}
            description={
              hasFilters
                ? "Modifiez la recherche ou les filtres pour élargir les résultats."
                : "Créez un premier projet pour votre promotion."
            }
          />
        ) : (
          <div className="grid gap-6">
            {filteredProjects?.map((project) => (
              <Card key={project.id} className="transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="text-xl">
                        <Link href={`/projects/${project.id}`} className="hover:underline">
                          {project.name}
                        </Link>
                      </CardTitle>
                      <CardDescription className="text-sm">
                        {project.promotionName || project.promotion?.name || "Promotion non définie"} • Créé le {formatDate(project.createdAt)}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(project.status)}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0" aria-label="Actions sur le projet">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/projects/${project.id}`}>Voir détails</Link>
                          </DropdownMenuItem>
                          <EditProjectDialog
                            projectId={project.id}
                            trigger={
                              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                Modifier
                              </DropdownMenuItem>
                            }
                            onSaved={(updated) =>
                              setProjects((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...(updated as Partial<Project>) } : p)))
                            }
                          />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setPendingDelete(project)}
                          >
                            Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{project.description}</p>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                    <div className="flex items-center space-x-2">
                      <Users aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">
                          {project?.promotion?.students?.length ?? 0}
                        </div>
                        <div className="text-xs text-muted-foreground">Étudiants</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <FolderOpen aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">{project?.groups?.length ?? 0}</div>
                        <div className="text-xs text-muted-foreground">Groupes</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <FileText aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">{project?.deliverables?.length ?? 0}</div>
                        <div className="text-xs text-muted-foreground">Livrables</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Calendar aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="text-sm font-medium">{formatDate(project.updatedAt)}</div>
                        <div className="text-xs text-muted-foreground">Dernière MAJ</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm">
                      <Link href={`/projects/${project.id}`}>Gérer</Link>
                    </Button>
                    <EditProjectDialog
                      projectId={project.id}
                      trigger={<Button variant="outline" size="sm">Modifier</Button>}
                      onSaved={(updated) =>
                        setProjects((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...(updated as Partial<Project>) } : p)))
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => { if (!open) setPendingDelete(null) }}
        onConfirm={confirmDelete}
        title="Supprimer ce projet ?"
        description={`« ${pendingDelete?.name ?? ""} » sera définitivement supprimé avec ses groupes, livrables, soutenances et grilles de notation.`}
        confirmText="Supprimer"
        variant="destructive"
      />
    </MainLayout>
  )
}
