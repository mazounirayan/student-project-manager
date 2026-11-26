/** Opérations pures sur la répartition des étudiants en groupes (voir components/groups/GroupsBoard.tsx). */
import type { ProjectGroup, ProjectPerson } from "@/lib/projects"

/** Place un étudiant dans un groupe (ou hors de tout groupe si `targetGroupId` est null), en le retirant de son groupe actuel. */
export function moveStudent(groups: ProjectGroup[], student: ProjectPerson, targetGroupId: number | null): ProjectGroup[] {
  return groups.map((group) => {
    const without = group.members.filter((member) => member.id !== student.id)
    return group.id === targetGroupId ? { ...group, members: [...without, student] } : without.length === group.members.length ? group : { ...group, members: without }
  })
}

export interface AutoDistributionPlan {
  /** Nombre de groupes à créer en plus des groupes existants, faute de places. */
  newGroups: number
  /** Pour chaque étudiant à placer, l’indice du groupe retenu : les groupes existants d’abord, puis les nouveaux. */
  placements: { student: ProjectPerson; slot: number }[]
}

/**
 * Répartit au hasard les étudiants restants : chacun va dans le groupe le moins rempli qui a encore de la place,
 * ce qui équilibre les effectifs. S’il manque de la place, on prévoit juste assez de nouveaux groupes.
 */
export function planAutoDistribution(
  unassigned: ProjectPerson[],
  groups: Pick<ProjectGroup, "members">[],
  maxSize: number,
  random: () => number = Math.random,
): AutoDistributionPlan {
  const free = groups.reduce((total, group) => total + Math.max(0, maxSize - group.members.length), 0)
  const missing = Math.max(0, unassigned.length - free)
  const newGroups = Math.ceil(missing / maxSize)

  const counts = [...groups.map((group) => group.members.length), ...Array<number>(newGroups).fill(0)]
  const shuffled = [...unassigned]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  const placements = shuffled.map((student) => {
    let slot = -1
    counts.forEach((count, index) => {
      if (count < maxSize && (slot === -1 || count < counts[slot])) slot = index
    })
    counts[slot]++
    return { student, slot }
  })
  return { newGroups, placements }
}
