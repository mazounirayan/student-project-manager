export interface Project {
  id: string
  name: string
  description: string
  status: "draft" | "visible" | "completed"
  promotionId: string
  promotionName: string
  createdAt: Date
  updatedAt: Date
  teacherId: string
  studentsCount: number
  groupsCount: number
  deliverablesCount: number
}

export interface Promotion {
  id: string
  name: string
  year: string
  studentsCount: number
  createdAt: Date
  updatedAt: Date
  teacherId: string
  students?: any[]
  projects?: any[]
}

export interface Student {
  id: string
  name: string
  email: string
  promotionId: string
  groupId?: string
  createdAt: Date
}
