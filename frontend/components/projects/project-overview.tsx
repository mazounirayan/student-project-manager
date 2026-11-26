"use client"

import { Circle, CheckCircle2 } from "lucide-react"
import { SectionCard } from "@/components/shared/SectionCard"
import { StatTile } from "@/components/shared/StatTile"
import { Button } from "@/components/ui/button"
import { formatDate, formatDateTime, formatDayMonth } from "@/lib/format"
import {
  deliverablesOf,
  formationClosed,
  formationLabel,
  groupSizeLabel,
  groupsOf,
  projectChecklist,
  studentsOf,
  ungroupedStudents,
  type ChecklistAction,
} from "@/lib/projects"
import type { Project } from "@/services/project.service"
import { ProjectStatusBadge } from "./project-status-badge"

interface ProjectOverviewProps {
  project: Project
  /** Ouvre l’onglet où mener l’étape, ou la lance directement pour la publication. */
  onAction: (action: ChecklistAction) => void
}

/** Vue d’ensemble d’un projet pour l’enseignant : chiffres clés, étapes restantes, consignes et paramètres. */
export function ProjectOverview({ project, onAction }: ProjectOverviewProps) {
  const students = studentsOf(project)
  const groups = groupsOf(project)
  const waiting = ungroupedStudents(project).length
  const deliverables = deliverablesOf(project)
  const steps = projectChecklist(project)
  const firstTodo = steps.find((step) => !step.done)

  const upcoming = deliverables
    .map((deliverable) => new Date(deliverable.deadline).getTime())
    .filter((time) => time >= Date.now())
    .sort((a, b) => a - b)[0]
  const deliverableHint = deliverables.length === 0 ? "Aucun pour l’instant" : upcoming ? `Prochaine échéance le ${formatDayMonth(new Date(upcoming))}` : "Toutes les échéances sont passées"

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Étudiants" value={students.length} hint="dans la promotion" />
        <StatTile label="Sans groupe" value={waiting} hint={students.length > 0 ? `sur ${students.length}` : "aucun étudiant à placer"} emphasis={waiting > 0} />
        <StatTile label="Groupes" value={groups.length} hint={groupSizeLabel(project)} />
        <StatTile label="Livrables" value={deliverables.length} hint={deliverableHint} />
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <SectionCard title={firstTodo ? "Pour lancer le projet" : "Le projet est prêt"} description={firstTodo ? "Les étapes qui restent avant que les étudiants puissent travailler." : "Groupes constitués, livrables définis et projet visible."}>
            <ol className="divide-y">
              {steps.map((step) => (
                <li key={step.key} className="flex flex-wrap items-start gap-x-3 gap-y-2 py-3 first:pt-0 last:pb-0">
                  {step.done ? (
                    <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  ) : (
                    <Circle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-[1_1_14rem]">
                    <p className="text-sm font-medium">
                      {step.title}
                      <span className="sr-only">{step.done ? " (fait)" : " (à faire)"}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">{step.detail}</p>
                  </div>
                  {!step.done && (
                    <Button size="sm" variant={step === firstTodo ? "default" : "outline"} onClick={() => onAction(step.key)}>
                      {step.actionLabel}
                    </Button>
                  )}
                </li>
              ))}
            </ol>
          </SectionCard>

          <SectionCard title="Description et consignes" description="Le texte que les étudiants lisent sur la page du projet.">
            <p className="whitespace-pre-line text-sm leading-relaxed">{project.description}</p>
          </SectionCard>
        </div>

        <SectionCard title="Paramètres">
          <dl className="space-y-3 text-sm">
            <Row label="Visibilité">
              <ProjectStatusBadge status={project.status} />
            </Row>
            <Row label="Promotion">{project.promotionName ?? "–"}</Row>
            <Row label="Formation des groupes">{formationLabel(project)}</Row>
            <Row label="Taille des groupes">{groupSizeLabel(project).replace(" par groupe", "")}</Row>
            <Row label="Date limite des groupes">
              {project.groupFormationDeadline ? (
                <>
                  {formatDateTime(project.groupFormationDeadline)}
                  {formationClosed(project) && <span className="text-muted-foreground"> (passée)</span>}
                </>
              ) : (
                "Aucune"
              )}
            </Row>
            <Row label="Créé le">{formatDate(project.createdAt)}</Row>
            <Row label="Modifié le">{formatDate(project.updatedAt)}</Row>
          </dl>
        </SectionCard>
      </div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  )
}
