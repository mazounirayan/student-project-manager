import { apiPost } from "@/lib/api"

export interface SubmitDeliverablePayload {
  groupId: number
  file?: File | null
  gitUrl?: string
}

/** Soumission d'un livrable par un groupe (fichier ou lien Git). */
export function submitDeliverable(deliverableId: number, data: SubmitDeliverablePayload): Promise<unknown> {
  const formData = new FormData()
  formData.append("groupId", String(data.groupId))
  if (data.gitUrl) formData.append("gitUrl", data.gitUrl)
  if (data.file) formData.append("file", data.file)
  return apiPost(`/deliverables/${deliverableId}/submit`, formData)
}
