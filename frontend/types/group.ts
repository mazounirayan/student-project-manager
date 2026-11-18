export interface Group {
  id: string
  name: string
  projectId: string
  projectName: string
  members: GroupMember[]
  maxMembers: number
  status: "incomplete" | "complete" | "full"
  createdAt: Date
  updatedAt: Date
}

export interface GroupMember {
  id: string
  name: string
  email: string
  role: "leader" | "member"
  joinedAt: Date
  skills?: string[]
  phone?: string
}

export interface GroupFormationRule {
  projectId: string
  mode: "manual" | "random" | "free"
  minSize: number
  maxSize: number
  deadline?: Date
  allowSelfSelection: boolean
}

// src/types/grouping.types.ts
export interface GroupSavePayload {
  groups: { id: number; memberIds: number[] }[];
  unassignedIds: number[];
}
