"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { ArrowLeft, CheckCircle2, Loader2, Plus, UserPlus } from "lucide-react"
import { toast } from "sonner"
import { QuietEmpty } from "@/components/dashboard/parts"
import { MainLayout } from "@/components/layout/main-layout"
import { PageContainer, PageHeader } from "@/components/layout/page"
import { StudentDefenseCard } from "@/components/projects/StudentDefenseCard"
import { DueBadge } from "@/components/shared/DueBadge"
import { ErrorState } from "@/components/shared/ErrorState"
import { SectionCard } from "@/components/shared/SectionCard"
import { DetailSkeleton } from "@/components/shared/Skeletons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { useDocumentTitle } from "@/hooks/use-document-title"
import { errorMessage } from "@/lib/api"
import { confirmAction } from "@/lib/dialogs"
import { formatFullDateTime, formatShortDateTime, plural } from "@/lib/format"
import { fullName } from "@/lib/people"
import {
  defensesOf,
  deliverablesOf,
  formationClosed,
  formationLabel,
  groupFill,
  groupSizeLabel,
  groupsOf,
  isFreeFormation,
  maxGroupSize,
  studentGroupState,
  type ProjectGroup,
} from "@/lib/projects"
import { projectPath, useRouteProjectId } from "@/lib/routes"
import { createGroup, joinGroup, leaveGroup } from "@/services/groups.service"
import { getProjectById, type Project } from "@/services/project.service"

interface ProjectDetailsPageProps {
  params: { id: string }
}

export function StudentProjectDetailsPageContent({ params }: ProjectDetailsPageProps) {
  const projectId = useRouteProjectId(params.id)
  const { user } = useAuth()
  const studentId = user?.id ?? 0
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  useDocumentTitle(project?.name)

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true)
      setError(null)
      try {
        setProject(await getProjectById(projectId))
      } catch (err) {
        setError(errorMessage(err, "Impossible de charger ce projet."))
      } finally {
        setLoading(false)
      }
    },
    [projectId],
  )

  useEffect(() => {
    load()
  }, [load])

  // Le lien « Rejoindre ou créer un groupe » de la liste pointe vers #groupes : on y amène la page une fois chargée.
  useEffect(() => {
    if (!loading && project && window.location.hash === "#groupes") document.getElementById("groupes")?.scrollIntoView()
  }, [loading, project])

  /** Lance une action sur les groupes, puis recharge le projet : l’état affiché est toujours celui du serveur. */
  const act = async (action: () => Promise<unknown>, success: string, failure: string) => {
    setPending(true)
    try {
      await action()
      toast.success(success)
      await load(true)
    } catch (err) {
      toast.error(failure, { description: errorMessage(err, "Réessayez dans un instant.") })
    } finally {
      setPending(false)
    }
  }

  if (loading) {
    return (
      <MainLayout>
        <PageContainer>
          <DetailSkeleton />
        </PageContainer>
      </MainLayout>
    )
  }

  if (error || !project) {
    return (
      <MainLayout>
        <PageContainer>
          <BackToProjects />
          <ErrorState message={error ?? "Projet introuvable."} onRetry={() => load()} />
        </PageContainer>
      </MainLayout>
    )
  }

  const groups = groupsOf(project)
  const { group: myGroup, state } = studentGroupState(project, studentId)
  const maxSize = maxGroupSize(project)
  const deadline = project.groupFormationDeadline
  const deadlineText = deadline ? ` jusqu’au ${formatShortDateTime(deadline)}` : ""
  const mySubmissions = deliverablesOf(project).some((deliverable) => deliverable.submissions?.some((s) => s.groupId === myGroup?.id))
  const canLeave = state === "member" && isFreeFormation(project) && !formationClosed(project)

  const join = async (group: ProjectGroup) => {
    const mates = group.members.map(fullName)
    const confirmed = await confirmAction({
      title: `Rejoindre ${group.name} ?`,
      description: `${mates.length > 0 ? `Vous serez avec ${mates.join(", ")}.` : "Vous en serez le premier membre."} Vous pourrez le quitter${deadlineText || " tant que les groupes ne sont pas figés"}.`,
      confirmText: "Rejoindre le groupe",
    })
    if (confirmed) await act(() => joinGroup(group.id), `Vous êtes dans ${group.name}.`, "Vous n’avez pas pu rejoindre ce groupe.")
  }

  const create = async () => {
    const confirmed = await confirmAction({
      title: "Créer un nouveau groupe ?",
      description: `Vous en serez le premier membre : vos camarades pourront ensuite le rejoindre, dans la limite de ${plural(maxSize, "étudiant")}.`,
      confirmText: "Créer le groupe",
    })
    if (confirmed) await act(() => createGroup(project.id), "Votre groupe est créé.", "Le groupe n’a pas été créé.")
  }

  const leave = async (group: ProjectGroup) => {
    const alone = group.members.length === 1
    const confirmed = await confirmAction({
      title: `Quitter ${group.name} ?`,
      description:
        `Vous n’aurez plus accès à l’espace de ce groupe.${mySubmissions ? " Les rendus déjà déposés restent au nom du groupe." : ""}${alone ? " Vous en êtes le seul membre : il restera vide." : ""}` +
        ` Vous pourrez rejoindre un autre groupe ou en créer un${deadlineText}.`,
      confirmText: "Quitter le groupe",
      destructive: true,
    })
    if (confirmed) await act(() => leaveGroup(group.id), `Vous avez quitté ${group.name}.`, "Vous n’avez pas pu quitter ce groupe.")
  }

  const dates = collectDates(project, myGroup, state === "can-join")

  return (
    <MainLayout>
      <PageContainer>
        <BackToProjects />
        <PageHeader
          title={project.name}
          description={project.teacherName ? `Enseignant : ${project.teacherName}` : undefined}
          actions={
            myGroup && (
              <Button asChild>
                <Link href={projectPath("/my-projects", project.id, "/group")}>Ouvrir l’espace du groupe</Link>
              </Button>
            )
          }
        />

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
          <div className="min-w-0 space-y-6 lg:col-span-2">
            <SectionCard title="Consignes">
              {project.description ? (
                <p className="whitespace-pre-line text-sm leading-relaxed">{project.description}</p>
              ) : (
                <QuietEmpty>Votre enseignant n’a pas encore rédigé de consignes.</QuietEmpty>
              )}
            </SectionCard>

            <div id="groupes" className="scroll-mt-6">
              <SectionCard
                title="Groupes du projet"
                description={`${plural(groups.length, "groupe")} · ${groupSizeLabel(project).toLowerCase()}`}
              >
                {state === "can-join" && (
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/40 p-3">
                    <p className="text-sm">
                      <span className="font-medium">Choisissez votre groupe</span>
                      <span className="text-muted-foreground">{deadlineText ? `, avant le ${formatShortDateTime(deadline)}` : ""}. Vous pouvez aussi créer le vôtre.</span>
                    </p>
                    <Button variant="outline" disabled={pending} onClick={create}>
                      <Plus aria-hidden="true" className="h-4 w-4" />
                      Créer un groupe
                    </Button>
                  </div>
                )}

                {groups.length === 0 ? (
                  <QuietEmpty>
                    {state === "can-join" ? "Aucun groupe n’existe encore : créez le premier ci-dessus." : "Votre enseignant n’a pas encore constitué les groupes. Revenez plus tard : vous les verrez ici."}
                  </QuietEmpty>
                ) : (
                  <ul className="grid gap-4 sm:grid-cols-2">
                    {groups.map((group) => {
                      const mine = group.id === myGroup?.id
                      const fill = groupFill(group, project)
                      return (
                        <li key={group.id} className={`rounded-lg border p-4 ${mine ? "border-primary bg-primary/5" : ""}`}>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="font-semibold">{group.name}</h3>
                            <span className="flex items-center gap-2">
                              {mine && <Badge>Votre groupe</Badge>}
                              {fill === "full" && !mine && <Badge variant="secondary">Complet</Badge>}
                              <span className="text-sm tabular-nums text-muted-foreground">
                                {group.members.length}/{maxSize}
                              </span>
                            </span>
                          </div>
                          {group.members.length > 0 ? (
                            <ul className="mt-3 space-y-1 text-sm">
                              {group.members.map((member) => (
                                <li key={member.id}>{fullName(member)}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-3 text-sm text-muted-foreground">Aucun membre pour l’instant.</p>
                          )}
                          {mine && canLeave && (
                            <Button variant="outline" size="sm" className="mt-4" disabled={pending} onClick={() => leave(group)}>
                              Quitter ce groupe
                            </Button>
                          )}
                          {!mine && state === "can-join" && fill !== "full" && (
                            <Button size="sm" className="mt-4" disabled={pending} onClick={() => join(group)}>
                              {pending ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <UserPlus aria-hidden="true" className="h-4 w-4" />}
                              Rejoindre
                            </Button>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </SectionCard>
            </div>
          </div>

          <div className="min-w-0 space-y-6">
            <SectionCard title="Votre groupe">
              {myGroup ? (
                <div className="space-y-3">
                  <p className="flex flex-wrap items-center gap-2 text-sm">
                    <CheckCircle2 aria-hidden="true" className="h-4 w-4 text-primary" />
                    <span className="font-medium">{myGroup.name}</span>
                    <span className="text-muted-foreground">· {plural(myGroup.members.length, "membre")}</span>
                  </p>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {myGroup.members.map((member) => (
                      <li key={member.id}>{fullName(member)}</li>
                    ))}
                  </ul>
                  <Button asChild className="w-full">
                    <Link href={projectPath("/my-projects", project.id, "/group")}>Livrables et rapport du groupe</Link>
                  </Button>
                </div>
              ) : state === "can-join" ? (
                <QuietEmpty>Vous n’avez pas encore de groupe. Rejoignez-en un ou créez le vôtre dans la liste des groupes.</QuietEmpty>
              ) : state === "waiting" ? (
                <QuietEmpty>Votre enseignant constitue les groupes. Vous serez placé dans l’un d’eux : revenez vérifier plus tard.</QuietEmpty>
              ) : (
                <QuietEmpty>La date limite est passée et vous n’avez pas de groupe. Contactez votre enseignant.</QuietEmpty>
              )}
            </SectionCard>

            {myGroup && <StudentDefenseCard defenses={defensesOf(project)} groupId={myGroup.id} />}

            <SectionCard title="Dates à retenir">
              {dates.length === 0 ? (
                <QuietEmpty>Aucune date pour l’instant. Les échéances apparaîtront ici dès qu’elles seront fixées.</QuietEmpty>
              ) : (
                <ul className="divide-y">
                  {dates.map((item) => (
                    <li key={item.key} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 py-2.5 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {item.href ? (
                            <Link href={item.href} className="rounded-sm hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                              {item.title}
                            </Link>
                          ) : (
                            item.title
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">{item.when}</p>
                      </div>
                      {item.done ? (
                        <Badge variant={item.late ? "destructive" : "secondary"}>{item.late ? "Rendu en retard" : "Rendu"}</Badge>
                      ) : (
                        item.badge && <DueBadge date={item.date} />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard title="Règles des groupes">
              <dl className="space-y-2 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Taille</dt>
                  <dd className="font-medium">{groupSizeLabel(project).replace(" par groupe", "")}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Formation</dt>
                  <dd className="font-medium">{formationLabel(project)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Date limite</dt>
                  <dd className="font-medium">{deadline ? formatFullDateTime(deadline) : "Aucune"}</dd>
                </div>
              </dl>
            </SectionCard>
          </div>
        </div>
      </PageContainer>
    </MainLayout>
  )
}

function BackToProjects() {
  return (
    <Link
      href="/my-projects"
      className="mb-4 inline-flex items-center gap-1 rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <ArrowLeft aria-hidden="true" className="h-4 w-4" />
      Mes projets
    </Link>
  )
}

interface ProjectDate {
  key: string
  title: string
  when: string
  date: string
  done: boolean
  /** Rendu déposé après l’échéance. */
  late?: boolean
  /** Page où agir (le livrable se rend depuis l’espace du groupe). */
  href?: string
  /** Affiche le délai restant (ou le dépassement) à côté de la date. */
  badge: boolean
}

/** Dates du projet utiles à l’étudiant : constitution des groupes et livrables (rendu ou non). La soutenance a sa propre carte. */
function collectDates(project: Project, myGroup: ProjectGroup | null, groupsOpen: boolean): ProjectDate[] {
  const items: ProjectDate[] = []
  if (project.groupFormationDeadline) {
    items.push({
      key: "groups",
      title: "Constitution des groupes",
      when: formatShortDateTime(project.groupFormationDeadline),
      date: project.groupFormationDeadline,
      done: false,
      badge: groupsOpen,
    })
  }
  for (const deliverable of deliverablesOf(project)) {
    const submission = myGroup ? deliverable.submissions?.find((item) => item.groupId === myGroup.id) : undefined
    items.push({
      key: `d-${deliverable.id}`,
      title: deliverable.name,
      when: formatShortDateTime(deliverable.deadline),
      date: deliverable.deadline,
      done: Boolean(submission),
      late: submission?.isLate,
      href: myGroup ? projectPath("/my-projects", project.id, "/group") : undefined,
      badge: true,
    })
  }
  return items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
}
