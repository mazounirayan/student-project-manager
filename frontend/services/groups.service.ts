import { apiDelete, apiPost, apiPut } from "@/lib/api"

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

/** Crée un groupe : vide si l’enseignante le demande, avec l’étudiant comme premier membre si c’est lui (formation libre). */
export function createGroup(projectId: number): Promise<ProjectGroup> {
  return apiPost<ProjectGroup>(`/groups/project/${projectId}`);
}

/** Un étudiant quitte son groupe (mode de formation libre, avant la date limite). */
export function leaveGroup(groupId: number): Promise<ProjectGroup> {
  return apiPost<ProjectGroup>(`/groups/${groupId}/leave`);
}

/** Supprime un groupe vide, sans rendu ni rapport. */
export function deleteGroup(groupId: number): Promise<void> {
  return apiDelete<void>(`/groups/${groupId}`);
}
