import { apiPost } from "@/lib/api"
import type { Submission } from "@/lib/deliverables"

export interface SubmitDeliverablePayload {
  groupId: number
  file?: File | null
  gitUrl?: string
}

/** Dépôt d’un livrable par un groupe (fichier ou lien Git). Un nouveau dépôt remplace le précédent du groupe. */
export function submitDeliverable(deliverableId: number, data: SubmitDeliverablePayload): Promise<Submission> {
  const formData = new FormData()
  formData.append("groupId", String(data.groupId))
  if (data.gitUrl) formData.append("gitUrl", data.gitUrl)
  if (data.file) formData.append("file", data.file)
  return apiPost<Submission>(`/deliverables/${deliverableId}/submit`, formData)
}
