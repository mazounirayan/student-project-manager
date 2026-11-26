"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { FolderOpen } from "lucide-react"
import { QuietEmpty } from "@/components/dashboard/parts"
import { StudentDeliverableCard } from "@/components/deliverables/StudentDeliverableCard"
import { MainLayout } from "@/components/layout/main-layout"
import { PageContainer, PageHeader } from "@/components/layout/page"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { EmptyState } from "@/components/shared/EmptyState"
import { ErrorState } from "@/components/shared/ErrorState"
import { SectionCard } from "@/components/shared/SectionCard"
import { CardsSkeleton } from "@/components/shared/Skeletons"
import { StatTile } from "@/components/shared/StatTile"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { errorMessage } from "@/lib/api"
import { studentAction, type Deliverable } from "@/lib/deliverables"
import { formatDayMonth, plural } from "@/lib/format"
import { studentGroupState } from "@/lib/projects"
import { fetchMyProjects, getProjectById } from "@/services/project.service"

interface MyDeliverable {
  deliverable: Deliverable
  projectId: number
  projectName: string
  groupId: number | null
}

export default function MyDeliverablesPage() {
  return (
    <ProtectedRoute roles={["student"]}>
      <MyDeliverablesPageContent />
    </ProtectedRoute>
  )
}

const byDeadline = (a: MyDeliverable, b: MyDeliverable) => new Date(a.deliverable.deadline).getTime() - new Date(b.deliverable.deadline).getTime()

function MyDeliverablesPageContent() {
  const { user } = useAuth()
  const studentId = user?.id
  const [items, setItems] = useState<MyDeliverable[]>([])
  const [unreadable, setUnreadable] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(
    async (silent = false) => {
      if (studentId === undefined) return
      if (!silent) setLoading(true)
      setError(null)
      try {
        const projects = await fetchMyProjects()
        const details = await Promise.allSettled(projects.map((project) => getProjectById(project.id)))
        const collected: MyDeliverable[] = []
        details.forEach((result, index) => {
          if (result.status !== "fulfilled") return
          const project = result.value
          const { group } = studentGroupState(project, studentId)
          for (const deliverable of (project.deliverables ?? []) as Deliverable[]) {
            collected.push({ deliverable, projectId: projects[index].id, projectName: project.name, groupId: group?.id ?? null })
          }
        })
        setUnreadable(details.filter((result) => result.status === "rejected").length)
        setItems(collected.sort(byDeadline))
      } catch (err) {
        setError(errorMessage(err, "Impossible de charger vos livrables."))
      } finally {
        setLoading(false)
      }
    },
    [studentId],
  )

  useEffect(() => {
    load()
  }, [load])

  const hasSubmission = (item: MyDeliverable) => item.groupId !== null && (item.deliverable.submissions ?? []).some((s) => s.groupId === item.groupId)
  const toHandIn = items.filter((item) => !hasSubmission(item) && studentAction(item.deliverable, null) !== "closed")
  const closed = items.filter((item) => !hasSubmission(item) && studentAction(item.deliverable, null) === "closed")
  const handedIn = items.filter(hasSubmission)
  const next = toHandIn.find((item) => new Date(item.deliverable.deadline).getTime() >= Date.now())

  const renderCard = (item: MyDeliverable) => (
    <StudentDeliverableCard
      key={`${item.projectId}-${item.deliverable.id}`}
      deliverable={item.deliverable}
      groupId={item.groupId}
      projectId={item.projectId}
      projectName={item.projectName}
      onChanged={() => load(true)}
    />
  )

  return (
    <MainLayout>
      <PageContainer width="narrow">
        <PageHeader title="Mes livrables" description="Ce que votre groupe doit rendre, ce qu’il a déjà rendu, et si tout est en règle." />

        {loading ? (
          <CardsSkeleton count={2} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => load()} />
        ) : items.length === 0 ? (
          <EmptyState
            icon={FolderOpen}
            title="Aucun livrable pour le moment"
            description="Les livrables de vos projets apparaîtront ici dès que votre enseignant en aura défini."
            action={
              <Button asChild variant="outline">
                <Link href="/my-projects">Voir mes projets</Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-3 gap-3">
              <StatTile label="À rendre" value={toHandIn.length} emphasis={toHandIn.length > 0} />
              <StatTile label="Rendus" value={handedIn.length} hint={`sur ${plural(items.length, "livrable")}`} />
              <StatTile
                label="Prochaine échéance"
                value={next ? formatDayMonth(next.deliverable.deadline) : "–"}
                hint={next ? next.deliverable.name : "aucune à venir"}
              />
            </div>

            {unreadable > 0 && (
              <p role="status" className="text-sm text-muted-foreground">
                Certains projets n’ont pas pu être chargés : leurs livrables manquent ici. Rechargez la page pour réessayer.
              </p>
            )}

            <SectionCard title="À rendre" description="Du plus proche au plus lointain.">
              {toHandIn.length === 0 ? (
                <QuietEmpty done>Rien à rendre pour le moment.</QuietEmpty>
              ) : (
                <div className="space-y-4">{toHandIn.map(renderCard)}</div>
              )}
            </SectionCard>

            {closed.length > 0 && (
              <SectionCard title="Dépôt fermé" description="L’échéance est passée et les rendus en retard ne sont pas acceptés.">
                <div className="space-y-4">{closed.map(renderCard)}</div>
              </SectionCard>
            )}

            <SectionCard title="Déjà rendus" description="Votre accusé de réception : l’heure, le retard éventuel et le résultat des règles.">
              {handedIn.length === 0 ? (
                <QuietEmpty>Aucun rendu pour l’instant : vos rendus apparaîtront ici.</QuietEmpty>
              ) : (
                <div className="space-y-4">{handedIn.map(renderCard)}</div>
              )}
            </SectionCard>
          </div>
        )}
      </PageContainer>
    </MainLayout>
  )
}
