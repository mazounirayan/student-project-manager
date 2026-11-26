"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { LogOut, Moon, Sun } from "lucide-react"
import { navFor } from "@/components/layout/nav"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

interface SidebarProps {
  className?: string
  onNavigate?: () => void
}

function ThemeToggle({ className }: { className?: string }) {
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

  const navItems = navFor(user?.role)

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  return (
    <div className={cn("flex h-full w-64 flex-col bg-sidebar border-r border-sidebar-border", className)}>
      <div className="flex h-16 items-center border-b border-sidebar-border px-6">
        <p className="text-lg font-semibold text-sidebar-foreground">Gestionnaire de projets</p>
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
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)

            return (
              <Button
                key={item.href}
                asChild
                variant={active ? "default" : "ghost"}
                className={cn(
                  "w-full justify-start",
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                )}
              >
                <Link href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined}>
                  <Icon className="mr-2 h-4 w-4" aria-hidden="true" />
                  {item.label}
                </Link>
              </Button>
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
