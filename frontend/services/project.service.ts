import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api"

export type ProjectStatus = "draft" | "visible"
export type GroupFormationRule = "manual" | "random" | "free"

export interface Project {
  id: number
  name: string
  description: string
  status: ProjectStatus
  minGroupSize?: number
  maxGroupSize?: number
  groupFormationRule?: GroupFormationRule
  groupFormationDeadline?: string | null
  promotionId?: number
  promotionName?: string
  promotion?: { id: number; name: string; students?: unknown[] }
  groups?: unknown[]
  deliverables?: unknown[]
  reports?: unknown[]
  defenses?: unknown[]
  gradingGrids?: unknown[]
  teacherName?: string
  createdAt: string
  updatedAt: string
}

export interface CreateProjectPayload {
  name: string
  description: string
  status: ProjectStatus
  promotionId: number
  minGroupSize?: number
  maxGroupSize?: number
  groupFormationRule?: GroupFormationRule
  groupFormationDeadline?: string | null
}

/** Projets visibles par l’utilisateur connecté (enseignant : les siens, étudiant : ceux de ses promotions). */
export function fetchMyProjects(): Promise<Project[]> {
  return apiGet<Project[]>("/projects/my")
}

/** Détail complet d’un projet (groupes, livrables, soumissions, rapports, soutenances, grilles). */
export function getProjectById(id: number | string): Promise<Project> {
  const projectId = Number.parseInt(String(id), 10)
  if (Number.isNaN(projectId)) {
    return Promise.reject(new Error("Identifiant de projet invalide"))
  }
  return apiGet<Project>(`/projects/${projectId}`)
}

export function createProject(payload: CreateProjectPayload): Promise<Project> {
  return apiPost<Project>("/projects", payload)
}

export type UpdateProjectPayload = Partial<CreateProjectPayload>

export function updateProject(id: number, payload: UpdateProjectPayload): Promise<Project> {
  return apiPut<Project>(`/projects/${id}`, payload)
}

export function deleteProject(id: number): Promise<void> {
  return apiDelete<void>(`/projects/${id}`)
}
