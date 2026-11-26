// src/types/report.ts
export interface ReportSection {
  id: number
  title: string
  content: string
  orderIndex: number
  sectionConfigId?: number
  reportId: number
  createdAt: Date
  updatedAt: Date
}

export interface Report {
  id: number
  title: string
  description?: string
  status: 'draft' | 'submitted'
  submittedAt?: Date
  projectId: number
  groupId: number
  sections: ReportSection[]
  createdAt: Date
  updatedAt: Date
  group?: {
    id: number
    name: string
    members?: any[]
  }
}
export interface ReportSectionConfig {
  id?: number
  title: string
  description: string
  required: boolean
  wordLimit?: number
  order: number
}

export interface ReportConfig {
  id?: number
  projectId: number
  isEnabled: boolean
  format: 'markdown' | 'html'
  instructions?: string
  deadline?: string
  sections: ReportSectionConfig[]
}
export interface ReportSummary {
  groupId: number
  groupName: string
  reportId: number
  completedSections: number
  totalSections: number
  lastModified: Date
  hasGrade: boolean
  grade?: number
}