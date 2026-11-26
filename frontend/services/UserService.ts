import { apiGet, apiPut } from "@/lib/api"

export interface AppUser {
  id: number
  email: string
  firstName: string
  lastName: string
  role: "teacher" | "student"
  isActive: boolean
  createdAt: string
  studentPromotions?: { id: number; name: string }[]
  teacherPromotions?: { id: number; name: string }[]
}

export const userService = {
  getAllStudents(): Promise<AppUser[]> {
    return apiGet<AppUser[]>("/users/students")
  },

  getAllTeachers(): Promise<AppUser[]> {
    return apiGet<AppUser[]>("/users/teachers")
  },

  deactivate(id: number): Promise<AppUser> {
    return apiPut<AppUser>(`/users/${id}/deactivate`)
  },
}
