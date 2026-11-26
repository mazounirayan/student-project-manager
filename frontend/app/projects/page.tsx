"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Eye, EyeOff, FolderOpen, GraduationCap, MoreHorizontal, Pencil, Plus, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { QuietEmpty } from "@/components/dashboard/parts"
import { MainLayout } from "@/components/layout/main-layout"
import { PageContainer, PageHeader } from "@/components/layout/page"
import { CreateProjectDialog } from "@/components/projects/create-project-dialog"
import { EditProjectDialog } from "@/components/projects/edit-project-dialog"
import { ProjectStatusBadge } from "@/components/projects/project-status-badge"
import { EmptyState } from "@/components/shared/EmptyState"
import { ErrorState } from "@/components/shared/ErrorState"
import { CardsSkeleton } from "@/components/shared/Skeletons"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { errorMessage } from "@/lib/api"
import { formatDate, plural } from "@/lib/format"
import { normalizeText } from "@/lib/people"
import { confirmDeleteProject, confirmVisibility, deliverablesOf, groupsOf, nextStep, studentsOf } from "@/lib/projects"
import { projectPath } from "@/lib/routes"
import {
  createProject,
  deleteProject,
  fetchMyProjects,
  updateProject,
  type CreateProjectPayload,
  type Project,
  type UpdateProjectPayload,
} from "@/services/project.service"
import { promotionService, type Promotion } from "@/services/PromotionService"

export default function ProjectsPage() {
  return (
    <ProtectedRoute roles={["teacher"]}>
      <ProjectsPageContent />
    </ProtectedRoute>
  )
}

type Dialog = { kind: "create" } | { kind: "edit"; id: number } | null

function ProjectsPageContent() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialog, setDialog] = useState<Dialog>(null)

  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("all")
  const [promotionId, setPromotionId] = useState("all")

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      const [projectList, promotionList] = await Promise.all([fetchMyProjects(), promotionService.getAll()])
      setProjects(Array.isArray(projectList) ? projectList : [])
      setPromotions(Array.isArray(promotionList) ? promotionList : [])
    } catch (err) {
      setError(errorMessage(err, "Impossible de charger les projets."))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const shown = useMemo(() => {
    const words = normalizeText(query).split(/\s+/).filter(Boolean)
    return projects.filter((project) => {
      const haystack = normalizeText(`${project.name} ${project.description ?? ""} ${project.promotionName ?? ""}`)
      return (
        words.every((word) => haystack.includes(word)) &&
        (status === "all" || project.status === status) &&
        (promotionId === "all" || String(project.promotionId) === promotionId)
      )
    })
  }, [projects, query, status, promotionId])

  const filtering = query.trim() !== "" || status !== "all" || promotionId !== "all"
  const editing = dialog?.kind === "edit" ? projects.find((project) => project.id === dialog.id) : undefined

  const create = async (payload: CreateProjectPayload) => {
    const created = await createProject(payload)
    toast.success(`Projet « ${created.name} » créé.`)
    router.push(projectPath("/projects", created.id))
  }

  const save = async (project: Project, payload: UpdateProjectPayload) => {
    await updateProject(project.id, payload)
    setDialog(null)
    toast.success("Projet mis à jour.")
    await load(true)
  }

  const toggleVisibility = async (project: Project) => {
    const makeVisible = project.status !== "visible"
    if (!(await confirmVisibility(project, makeVisible))) return
    try {
      await updateProject(project.id, { status: makeVisible ? "visible" : "draft" })
      toast.success(makeVisible ? `« ${project.name} » est visible par les étudiants.` : `« ${project.name} » repasse en brouillon.`)
      await load(true)
    } catch (err) {
      toast.error("Le statut du projet n’a pas changé.", { description: errorMessage(err, "Réessayez dans un instant.") })
    }
  }

  const remove = async (project: Project) => {
    if (!(await confirmDeleteProject(project))) return
    try {
      await deleteProject(project.id)
      setProjects((current) => current.filter((item) => item.id !== project.id))
      toast.success(`Projet « ${project.name} » supprimé.`)
    } catch (err) {
      toast.error("Le projet n’a pas été supprimé.", { description: errorMessage(err, "Réessayez dans un instant.") })
    }
  }

  const noPromotion = !loading && !error && promotions.length === 0

  return (
    <MainLayout>
      <PageContainer>
        <PageHeader
          title="Projets"
          description="Vos projets, par promotion : constituez les groupes, suivez les rendus et les soutenances."
          actions={
            promotions.length > 0 && (
              <Button onClick={() => setDialog({ kind: "create" })}>
                <Plus aria-hidden="true" className="h-4 w-4" />
                Nouveau projet
              </Button>
            )
          }
        />

        {loading ? (
          <CardsSkeleton count={3} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => load()} />
        ) : noPromotion ? (
          <EmptyState
            icon={GraduationCap}
            title="Créez d’abord une promotion"
            description="Un projet s’adresse à une promotion : ses étudiants le verront, puis se répartiront en groupes."
            action={
              <Button asChild>
                <Link href="/promotions">Aller aux promotions</Link>
              </Button>
            }
          />
        ) : projects.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="Aucun projet pour l’instant"
            description="Créez un projet pour une de vos promotions. Il reste en brouillon, invisible des étudiants, tant que vous ne l’avez pas rendu visible."
            action={
              <Button onClick={() => setDialog({ kind: "create" })}>
                <Plus aria-hidden="true" className="h-4 w-4" />
                Créer un projet
              </Button>
            }
          />
        ) : (
          <>
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <div className="relative min-w-[12rem] flex-1 sm:max-w-sm">
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input type="search" aria-label="Rechercher un projet" placeholder="Rechercher un projet" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger aria-label="Filtrer par statut" className="w-full sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="draft">Brouillons</SelectItem>
                  <SelectItem value="visible">Visibles</SelectItem>
                </SelectContent>
              </Select>
              {promotions.length > 1 && (
                <Select value={promotionId} onValueChange={setPromotionId}>
                  <SelectTrigger aria-label="Filtrer par promotion" className="w-full sm:w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les promotions</SelectItem>
                    {promotions.map((promotion) => (
                      <SelectItem key={promotion.id} value={String(promotion.id)}>
                        {promotion.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {filtering && (
                <p aria-live="polite" className="text-sm text-muted-foreground">
                  {plural(shown.length, "projet")} sur {projects.length}
                </p>
              )}
            </div>

            {shown.length === 0 ? (
              <EmptyState
                icon={Search}
                title="Aucun projet ne correspond"
                description="Modifiez la recherche ou les filtres pour élargir les résultats."
                action={
                  <Button
                    variant="outline"
                    onClick={() => {
                      setQuery("")
                      setStatus("all")
                      setPromotionId("all")
                    }}
                  >
                    Effacer les filtres
                  </Button>
                }
              />
            ) : (
              <ul className="grid gap-4">
                {shown.map((project) => (
                  <li key={project.id}>
                    <ProjectCard
                      project={project}
                      onEdit={() => setDialog({ kind: "edit", id: project.id })}
                      onToggleVisibility={() => toggleVisibility(project)}
                      onDelete={() => remove(project)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </PageContainer>

      <CreateProjectDialog open={dialog?.kind === "create"} onOpenChange={(open) => !open && setDialog(null)} promotions={promotions} onCreate={create} />
      {editing && (
        <EditProjectDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          project={editing}
          promotions={promotions}
          onSave={(payload) => save(editing, payload)}
        />
      )}
    </MainLayout>
  )
}

interface ProjectCardProps {
  project: Project
  onEdit: () => void
  onToggleVisibility: () => void
  onDelete: () => void
}

function ProjectCard({ project, onEdit, onToggleVisibility, onDelete }: ProjectCardProps) {
  const students = studentsOf(project).length
  const visible = project.status === "visible"
  const next = nextStep(project)

  return (
    <Card className="gap-4">
      <CardHeader>
        <h2 data-slot="card-title" className="flex flex-wrap items-center gap-x-3 gap-y-1 leading-snug font-semibold">
          <Link href={projectPath("/projects", project.id)} className="rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            {project.name}
          </Link>
          <ProjectStatusBadge status={project.status} />
        </h2>
        <CardDescription>
          {project.promotionName ?? "Promotion inconnue"} · créé le {formatDate(project.createdAt)}
        </CardDescription>
        <CardAction>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={`Actions sur le projet ${project.name}`}>
                <MoreHorizontal aria-hidden="true" className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onEdit}>
                <Pencil aria-hidden="true" className="h-4 w-4" />
                Modifier
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onToggleVisibility}>
                {visible ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />}
                {visible ? "Repasser en brouillon" : "Rendre visible"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                <Trash2 aria-hidden="true" className="h-4 w-4" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-3">
        {project.description && <p className="line-clamp-2 text-sm text-muted-foreground">{project.description}</p>}

        <p className="text-sm tabular-nums">
          <span className="font-medium">{plural(students, "étudiant")}</span>
          <span aria-hidden="true" className="text-muted-foreground"> · </span>
          <span className="text-muted-foreground">{plural(groupsOf(project).length, "groupe")}</span>
          <span aria-hidden="true" className="text-muted-foreground"> · </span>
          <span className="text-muted-foreground">{plural(deliverablesOf(project).length, "livrable")}</span>
        </p>

        {next ? (
          <p className="text-sm">
            <span className="text-muted-foreground">À faire : </span>
            <Link
              href={`${projectPath("/projects", project.id)}#${next.tab}`}
              className="rounded-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {next.label}
            </Link>
          </p>
        ) : (
          <QuietEmpty done>Groupes constitués, livrables définis, projet visible.</QuietEmpty>
        )}
      </CardContent>
    </Card>
  )
}
