import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api"

export interface PromotionStudent {
  id: number
  firstName: string
  lastName: string
  email: string
}

export interface Promotion {
  id: number
  name: string
  description?: string
  year: number
  createdAt: string
  students?: PromotionStudent[]
  projects?: unknown[]
}

export interface StudentForm {
  nom: string
  prenom: string
  email: string
}

export interface CreatePromotionData {
  name: string
  description: string
  year: number
}

export const promotionService = {
  getAll(): Promise<Promotion[]> {
    return apiGet<Promotion[]>("/promotions/my")
  },

  create(data: CreatePromotionData): Promise<Promotion> {
    return apiPost<Promotion>("/promotions", data)
  },

  update(id: number | string, data: Partial<CreatePromotionData>): Promise<Promotion> {
    return apiPut<Promotion>(`/promotions/${id}`, data)
  },

  delete(id: number): Promise<void> {
    return apiDelete<void>(`/promotions/${id}`)
  },

  addStudents(promotionId: number, students: StudentForm[]): Promise<Promotion> {
    const studentPayload = students.map((student) => ({
      email: student.email,
      firstName: student.prenom,
      lastName: student.nom,
    }))
    return apiPost<Promotion>(`/promotions/${promotionId}/students`, studentPayload)
  },

  deleteStudent(promotionId: number, studentId: number): Promise<void> {
    return apiDelete<void>(`/promotions/${promotionId}/students/${studentId}`)
  },

  importFile(promotionId: number, file: File): Promise<unknown> {
    const formdata = new FormData()
    formdata.append("file", file)
    // Pour FormData, le navigateur définit lui-même le Content-Type (frontière).
    return apiPost<unknown>(`/promotions/${promotionId}/students/import`, formdata)
  },
}
