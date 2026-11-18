import { ReactNode } from "react"

// Structure claire : Grille → Critères → Notes
export interface GradingGrid {
  title: ReactNode
  id: number
  projectId: number
  name: string
  description?: string
  type: 'deliverable' | 'report' | 'defense'
  weight: number // Poids de cette grille dans la note finale du projet
  deliverableId?: number // Si type='deliverable'
  createdAt: Date
  updatedAt: Date
  criteria: GradingCriterion[]
}

export interface GradingCriterion {
  id: number
  gridId: number
  name: string
  description?: string
  maxScore: number
  weight: number // Poids dans cette grille
  type: 'group' | 'individual'
  allowComments: boolean // Configuration du champ commentaire
  requireComments: boolean // Commentaire obligatoire ?
  order: number
}

export interface GradeEntry {
  id: number
  criterionId: number
  groupId: number
  studentId?: number // Si type='individual'
  score: number
  comment?: string
  gradedBy: number
  gradedAt: Date
  status: 'draft' | 'submitted' | 'validated'
}

export interface GradingSession {
  id: number
  gridId: number
  groupId: number
  entries: GradeEntry[]
  globalComment?: string
  totalScore: number
  status: 'draft' | 'submitted' | 'validated'
  gradedBy: number
  gradedAt: Date
  submittedAt?: Date
  validatedAt?: Date
}