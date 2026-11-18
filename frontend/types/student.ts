export interface StudentProject {
  id: string
  name: string
  description: string
  status: "active" | "completed"
  dueDate: Date
  progress: number
  groupId?: string
  groupName?: string
  teacherName: string
}

export interface StudentDeliverable {
  id: string
  title: string
  description: string
  projectId: string
  projectName: string
  groupId?: string
  dueDate: Date
  submittedAt?: Date
  status: "pending" | "submitted" | "late" | "graded"
  grade?: number
  maxGrade: number
  feedback?: string
}

export interface StudentReport {
  id: string
  title: string
  projectId: string
  projectName: string
  sections: ReportSection[]
  lastModified: Date
  wordCount: number
  status: "draft" | "submitted"
}

export interface ReportSection {
  id: string
  title: string
  content: string
  wordCount: number
}

export interface StudentGrade {
  id: string
  projectName: string
  type: "deliverable" | "report" | "presentation"
  title: string
  grade: number
  maxGrade: number
  feedback?: string
  gradedAt: Date
}
