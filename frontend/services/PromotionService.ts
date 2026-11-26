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
  projects?: { id: number; name?: string }[]
}

export interface StudentForm {
  firstName: string
  lastName: string
  email: string
}

export interface PromotionForm {
  name: string
  description: string
  year: number
}

/** Bilan d’un ajout d’étudiants : `errors` liste les lignes ignorées et les e-mails non partis. */
export interface EnrollmentSummary {
  totalProcessed: number
  newStudents: number
  existingStudents: number
  errors: string[]
}

export interface EnrollmentResult {
  promotion: Promotion
  summary: EnrollmentSummary
}

export const promotionService = {
  getAll(): Promise<Promotion[]> {
    return apiGet<Promotion[]>("/promotions/my")
  },

  create(data: PromotionForm): Promise<Promotion> {
    return apiPost<Promotion>("/promotions", data)
  },

  update(id: number, data: Partial<PromotionForm>): Promise<Promotion> {
    return apiPut<Promotion>(`/promotions/${id}`, data)
  },

  delete(id: number): Promise<void> {
    return apiDelete<void>(`/promotions/${id}`)
  },

  addStudents(promotionId: number, students: StudentForm[]): Promise<EnrollmentResult> {
    return apiPost<EnrollmentResult>(`/promotions/${promotionId}/students`, students)
  },

  deleteStudent(promotionId: number, studentId: number): Promise<void> {
    return apiDelete<void>(`/promotions/${promotionId}/students/${studentId}`)
  },
}
