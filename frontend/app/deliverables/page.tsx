"use client"

import Link from "next/link"
import { useCallback, useEffect, useMemo, useState } from "react"
import { FileText, FolderOpen } from "lucide-react"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { SubmissionDetailsDialog } from "@/components/deliverables/DeliverableGroupDetails"
import { DeliverableStats } from "@/components/deliverables/DeliverableStats"
import { SubmissionList } from "@/components/deliverables/SubmissionList"
import { MainLayout } from "@/components/layout/main-layout"
import { PageContainer, PageHeader } from "@/components/layout/page"
import { DueBadge } from "@/components/shared/DueBadge"
import { EmptyState } from "@/components/shared/EmptyState"
import { ErrorState } from "@/components/shared/ErrorState"
import { SectionCard } from "@/components/shared/SectionCard"
import { CardsSkeleton } from "@/components/shared/Skeletons"
import { StatTile } from "@/components/shared/StatTile"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { errorMessage } from "@/lib/api"
import { gradingHref, isPastDeadline, latePolicy, summarize, type Deliverable, type GroupRef, type GroupRow } from "@/lib/deliverables"
import { formatFullDateTime, plural } from "@/lib/format"
import { projectPath } from "@/lib/routes"
import { fetchMyProjects, getProjectById, type Project } from "@/services/project.service"

export default function DeliverablesPage() {
  return (
    <ProtectedRoute roles={["teacher"]}>
      <DeliverablesPageContent />
    </ProtectedRoute>
  )
}

function DeliverablesPageContent() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [projectLoading, setProjectLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [onlyAttention, setOnlyAttention] = useState(false)
  const [details, setDetails] = useState<{ deliverable: Deliverable; row: GroupRow } | null>(null)

  const loadProjects = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await fetchMyProjects()
      setProjects(list)
      setSelectedId((current) => current ?? (list[0] ? String(list[0].id) : null))
    } catch (err) {
      setError(errorMessage(err, "Impossible de charger vos projets."))
    } finally {
      setLoading(false)
    }
  }, [])

  const loadProject = useCallback(async () => {
    if (!selectedId) return
    setProjectLoading(true)
    setError(null)
    try {
      setProject(await getProjectById(selectedId))
    } catch (err) {
      setProject(null)
      setError(errorMessage(err, "Impossible de charger ce projet."))
    } finally {
      setProjectLoading(false)
    }
  }, [selectedId])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  useEffect(() => {
    loadProject()
  }, [loadProject])

  const groups = useMemo(() => (project?.groups ?? []) as GroupRef[], [project])
  const deliverables = useMemo(() => (project?.deliverables ?? []) as Deliverable[], [project])

  const totals = useMemo(() => {
    const parts = deliverables.map((deliverable) => summarize(deliverable, groups))
    const sum = (pick: (part: (typeof parts)[number]) => number) => parts.reduce((total, part) => total + pick(part), 0)
    return {
      expected: deliverables.length * groups.length,
      received: sum((p) => p.received),
      late: sum((p) => p.late),
      missing: sum((p) => p.missing),
      nonCompliant: sum((p) => p.nonCompliant),
      flagged: sum((p) => p.flagged),
      analysed: sum((p) => p.analysed),
    }
  }, [deliverables, groups])

  const manageHref = project ? `${projectPath("/projects", project.id)}#deliverables` : "/projects"

  return (
    <MainLayout>
      <PageContainer>
        <PageHeader
          title="Livrables"
          description="Qui a rendu, qui est en retard, ce qui n’est pas conforme et ce qui ressemble trop à un autre rendu."
          actions={
            projects.length > 0 && (
              <>
                <div className="w-full sm:w-72">
                  <Label htmlFor="deliverables-project" className="sr-only">
                    Projet
                  </Label>
                  <Select value={selectedId ?? undefined} onValueChange={setSelectedId}>
                    <SelectTrigger id="deliverables-project" className="w-full">
                      <SelectValue placeholder="Choisir un projet" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((item) => (
                        <SelectItem key={item.id} value={String(item.id)}>
                          {item.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {project && (
                  <Button asChild variant="outline">
                    <Link href={manageHref}>Gérer les livrables</Link>
                  </Button>
                )}
              </>
            )
          }
        />

        {loading ? (
          <CardsSkeleton count={2} />
        ) : error ? (
          <ErrorState message={error} onRetry={project || projects.length > 0 ? loadProject : loadProjects} />
        ) : projects.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="Aucun projet pour le moment"
            description="Créez un projet, ses groupes et ses livrables : le suivi des rendus apparaîtra ici."
            action={
              <Button asChild>
                <Link href="/projects">Voir les projets</Link>
              </Button>
            }
          />
        ) : projectLoading || !project ? (
          <CardsSkeleton count={2} />
        ) : deliverables.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Aucun livrable dans ce projet"
            description="Définissez ce que les groupes doivent rendre, avec une échéance et des règles de conformité."
            action={
              <Button asChild>
                <Link href={manageHref}>Créer un livrable</Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
              <StatTile
                label="Rendus reçus"
                value={`${totals.received}/${totals.expected}`}
                hint={`${plural(deliverables.length, "livrable")}, ${plural(groups.length, "groupe")}`}
              />
              <StatTile label="En retard" value={totals.late} hint="rendus après l’échéance" emphasis={totals.late > 0} />
              <StatTile label="Sans rendu" value={totals.missing} hint="échéance dépassée" emphasis={totals.missing > 0} />
              <StatTile label="Non conformes" value={totals.nonCompliant} hint="règles non respectées" emphasis={totals.nonCompliant > 0} />
              <StatTile
                label="À vérifier"
                value={totals.flagged}
                hint={totals.analysed === 0 ? "ressemblance non analysée" : "rendus à forte ressemblance"}
                emphasis={totals.flagged > 0}
              />
            </div>

            <div className="flex items-center gap-3">
              <Switch id="only-attention" checked={onlyAttention} onCheckedChange={setOnlyAttention} />
              <Label htmlFor="only-attention" className="font-normal">
                Afficher seulement les groupes qui demandent un regard
              </Label>
            </div>

            {deliverables.map((deliverable) => {
              const stats = summarize(deliverable, groups)
              return (
                <SectionCard
                  key={deliverable.id}
                  title={deliverable.name}
                  description={`Échéance : ${formatFullDateTime(deliverable.deadline)}`}
                  action={{ href: manageHref, label: "Gérer les livrables" }}
                >
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {stats.complete && isPastDeadline(deliverable.deadline) ? (
                          <Badge variant="secondary">Tous les groupes ont rendu</Badge>
                        ) : (
                          <DueBadge date={deliverable.deadline} />
                        )}
                        <Badge variant="outline">{deliverable.type === "archive" ? "Archive" : "Lien Git"}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{latePolicy(deliverable)}</p>
                    </div>
                    <DeliverableStats deliverable={deliverable} groups={groups} />
                    <SubmissionList
                      deliverable={deliverable}
                      groups={groups}
                      onlyAttention={onlyAttention}
                      onOpen={(row) => setDetails({ deliverable, row })}
                      gradeHref={gradingHref(project.id, deliverable.id)}
                    />
                  </div>
                </SectionCard>
              )
            })}
          </div>
        )}

        {details && (
          <SubmissionDetailsDialog
            open
            onOpenChange={(open) => !open && setDetails(null)}
            deliverable={details.deliverable}
            group={details.row.group}
            submission={details.row.submission}
            gradeHref={gradingHref(project?.id ?? 0, details.deliverable.id)}
          />
        )}
      </PageContainer>
    </MainLayout>
  )
}
