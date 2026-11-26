import { BarChart3, BookOpen, FileText, FolderOpen, GraduationCap, LayoutDashboard, Users, type LucideIcon } from "lucide-react"
import type { User } from "@/types/auth"

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

const HOME: NavItem = { href: "/", label: "Accueil", icon: LayoutDashboard }

const TEACHER_NAV: NavItem[] = [
  HOME,
  { href: "/promotions", label: "Promotions", icon: GraduationCap },
  { href: "/projects", label: "Projets", icon: FolderOpen },
  { href: "/deliverables", label: "Livrables", icon: FileText },
  { href: "/grading", label: "Évaluations", icon: BarChart3 },
  { href: "/users", label: "Utilisateurs", icon: Users },
]

const STUDENT_NAV: NavItem[] = [
  HOME,
  { href: "/my-projects", label: "Mes projets", icon: FolderOpen },
  { href: "/my-group", label: "Mon groupe", icon: Users },
  { href: "/my-deliverables", label: "Mes livrables", icon: FileText },
  { href: "/my-grades", label: "Mes notes", icon: BookOpen },
]

export function navFor(role: User["role"] | undefined): NavItem[] {
  return role === "teacher" ? TEACHER_NAV : STUDENT_NAV
}

/** Chemin sans barre finale (l’export statique ajoute une barre à chaque URL). */
function normalize(pathname: string): string {
  return pathname.replace(/\/+$/, "") || "/"
}

/** Une entrée est active sur sa page et sur ses sous-pages (/projects/3 → Projets) ; l’accueil, uniquement sur « / ». */
export function isNavActive(href: string, pathname: string): boolean {
  const path = normalize(pathname)
  return href === "/" ? path === "/" : path === href || path.startsWith(`${href}/`)
}

/** Entrée de navigation correspondant à la page courante (sert au titre de la barre mobile et de l’onglet). */
export function currentNavItem(role: User["role"] | undefined, pathname: string): NavItem | undefined {
  return navFor(role).find((item) => isNavActive(item.href, pathname))
}
