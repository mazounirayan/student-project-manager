/**
 * Types de la base de démonstration (stockée dans le localStorage).
 * Les formes sérialisées pour l’API sont produites par serialize.ts.
 */

export type DemoRole = "teacher" | "student"

export interface DemoUser {
  id: number
  email: string
  firstName: string
  lastName: string
  role: DemoRole
  isActive: boolean
  createdAt: string
}

export interface DemoPromotion {
  id: number
  name: string
  description: string
  year: number
  teacherId: number
  studentIds: number[]
  createdAt: string
}

export type DemoProjectStatus = "draft" | "visible"

export interface DemoProject {
  id: number
  name: string
  description: string
  status: DemoProjectStatus
  minGroupSize: number
  maxGroupSize: number
  groupFormationRule: "manual" | "random" | "free"
  groupFormationDeadline: string
  promotionId: number
  teacherId: number
  createdAt: string
  updatedAt: string
}

export interface DemoGroup {
  id: number
  projectId: number
  name: string
  memberIds: number[]
}

export type DemoDeliverableType = "archive" | "git_link"

export interface DemoDeliverable {
  id: number
  projectId: number
  name: string
  description: string
  type: DemoDeliverableType
  deadline: string
  allowLateSubmission: boolean
  penaltyPerHour: number
  createdAt: string
  updatedAt: string
}

export interface DemoValidationRule {
  id: number
  deliverableId: number
  type: "max_size" | "file_presence" | "folder_structure" | "file_content"
  configuration: string
  errorMessage?: string
}

export interface DemoSubmission {
  id: number
  deliverableId: number
  groupId: number
  fileName?: string
  fileSize?: number
  gitUrl?: string
  submittedAt: string
  isLate: boolean
  penalty: number
  similarityScore?: number
  validationResults?: Array<{ type: string; configuration?: string; passed: boolean; message: string }>
}

export interface DemoReportSectionConfig {
  id: number
  title: string
  description: string
  required: boolean
  wordLimit?: number
  order: number
}

export interface DemoReportConfig {
  projectId: number
  isEnabled: boolean
  format: "markdown" | "html"
  deadline: string
  instructions?: string
  sections: DemoReportSectionConfig[]
}

export interface DemoReport {
  id: number
  projectId: number
  groupId: number
  title: string
  status: "draft" | "submitted"
  submittedAt?: string
  sections: Array<{ sectionConfigId: number; content: string; updatedAt: string }>
}

export interface DemoDefense {
  id: number
  projectId: number
  groupId: number
  startTime: string
  endTime: string
  orderIndex: number
  location: string
}

export interface DemoCriterion {
  id: number
  gridId: number
  name: string
  description?: string
  maxScore: number
  weight: number
  type: "group" | "individual"
  hasComments: boolean
}

export interface DemoGradingGrid {
  id: number
  projectId: number
  name: string
  type: "deliverable" | "report" | "defense"
  weight: number
  description?: string
  deliverableId?: number
  criteria: DemoCriterion[]
}

export interface DemoSessionEntry {
  id: number
  criterionId: number
  score: number
  comment: string
}

export interface DemoSession {
  id: number
  gridId: number
  groupId: number
  entries: DemoSessionEntry[]
  globalComment: string
  totalScore: number
  status: "draft" | "submitted" | "validated"
  gradedBy: number
  gradedAt: string
  submittedAt?: string
  validatedAt?: string
}

export interface DemoDb {
  users: DemoUser[]
  promotions: DemoPromotion[]
  projects: DemoProject[]
  groups: DemoGroup[]
  deliverables: DemoDeliverable[]
  rules: DemoValidationRule[]
  submissions: DemoSubmission[]
  reportConfigs: DemoReportConfig[]
  reports: DemoReport[]
  defenses: DemoDefense[]
  grids: DemoGradingGrid[]
  sessions: DemoSession[]
  seq: number
}
