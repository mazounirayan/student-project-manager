import { BarChart3, BookOpen, FileText, FolderOpen, GraduationCap, Users, type LucideIcon } from "lucide-react"
import type { User } from "@/types/auth"

export interface NavItem {
  href: string
  label: string
  description: string
  icon: LucideIcon
}

const TEACHER_NAV: NavItem[] = [
  { href: "/promotions", label: "Promotions", description: "Cohortes et listes d’étudiants.", icon: GraduationCap },
  { href: "/projects", label: "Projets", description: "Groupes, livrables, soutenances et notation.", icon: FolderOpen },
  { href: "/deliverables", label: "Livrables", description: "Rendus reçus et échéances.", icon: FileText },
  { href: "/grading", label: "Évaluations", description: "Notes par projet et publication.", icon: BarChart3 },
  { href: "/users", label: "Utilisateurs", description: "Comptes enseignants et étudiants.", icon: Users },
]

const STUDENT_NAV: NavItem[] = [
  { href: "/my-projects", label: "Mes projets", description: "Consignes et dates limites.", icon: FolderOpen },
  { href: "/my-group", label: "Mon groupe", description: "Votre équipe et son rapport.", icon: Users },
  { href: "/my-deliverables", label: "Mes livrables", description: "Dépôts à faire et rendus.", icon: FileText },
  { href: "/my-grades", label: "Mes notes", description: "Évaluations publiées.", icon: BookOpen },
]

export function navFor(role: User["role"] | undefined): NavItem[] {
  return role === "teacher" ? TEACHER_NAV : STUDENT_NAV
}
