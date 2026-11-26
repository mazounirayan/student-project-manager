import { apiPost, apiPut } from "@/lib/api"

export type GroupSavePayload = {
  groups: { id: number; memberIds: number[] }[];
  unassignedIds: number[];
};

export type ProjectGroup = {
  id: number;
  name: string;
  members: { id: number; firstName: string; lastName: string; email: string }[];
};

/** Sauvegarde la répartition complète des groupes d’un projet. */
export function saveProjectGrouping(
  projectId: number,
  payload: GroupSavePayload
): Promise<{ message: string; updatedGroups: number; affectedLinks: number }> {
  return apiPut<{ message: string; updatedGroups: number; affectedLinks: number }>(
    `/projects/${projectId}/groups`,
    payload
  );
}

/** Un étudiant rejoint un groupe (mode de formation libre uniquement). */
export function joinGroup(groupId: number): Promise<ProjectGroup> {
  return apiPost<ProjectGroup>(`/groups/${groupId}/join`);
}
