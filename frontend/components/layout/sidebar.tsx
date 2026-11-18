"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import {
  Users,
  LogOut,
  GraduationCap,
  FolderOpen,
  Moon,
  Sun,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

interface SidebarProps {
  className?: string
  onNavigate?: () => void
}

/** Bascule clair / sombre (le choix est mémorisé par next-themes dans le localStorage). */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const isDark = resolvedTheme === "dark"

  return (
    <Button
      variant="ghost"
      aria-label={isDark ? "Passer en thème clair" : "Passer en thème sombre"}
      title={isDark ? "Thème clair" : "Thème sombre"}
      className={className}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {mounted && isDark ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
      {mounted ? (isDark ? "Thème clair" : "Thème sombre") : "Thème"}
    </Button>
  )
}

export function Sidebar({ className, onNavigate }: SidebarProps) {
  const { user, logout } = useAuth()
  const pathname = usePathname()

  const teacherNavItems: NavItem[] = [
    { href: "/promotions", label: "Promotions", icon: GraduationCap },
    { href: "/projects", label: "Projets", icon: FolderOpen },
    { href: "/users", label: "Utilisateurs", icon: Users },
  ]

  const studentNavItems: NavItem[] = [
    { href: "/my-projects", label: "Mes projets", icon: FolderOpen },
    { href: "/my-grades", label: "Mes notes", icon: GraduationCap },
  ]

  const navItems = user?.role === "teacher" ? teacherNavItems : studentNavItems

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  return (
    <div className={cn("flex h-full w-64 flex-col bg-sidebar border-r border-sidebar-border", className)}>
      <div className="flex h-16 items-center border-b border-sidebar-border px-6">
        <h2 className="text-lg font-semibold text-sidebar-foreground">Gestionnaire de Projets</h2>
      </div>

      <div className="flex-1 overflow-auto py-4">
        <div className="px-3 mb-4">
          <div className="text-xs font-medium text-sidebar-foreground/70 uppercase tracking-wider mb-2">
            {user?.role === "teacher" ? "Enseignant" : "Étudiant"}
          </div>
          <div className="text-sm text-sidebar-foreground">
            {user ? `${user.firstName} ${user.lastName}` : ""}
          </div>
          <div className="text-xs text-sidebar-foreground/70">{user?.email}</div>
        </div>

        <nav className="space-y-1 px-3">
          {navItems?.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)

            return (
              <Link key={item.href} href={item.href} onClick={onNavigate}>
                <Button
                  variant={active ? "default" : "ghost"}
                  className={cn(
                    "w-full justify-start",
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  )}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="border-t border-sidebar-border p-3 space-y-1">
        <ThemeToggle className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
        <Button
          variant="ghost"
          className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={logout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Déconnexion
        </Button>
      </div>
    </div>
  )
}
