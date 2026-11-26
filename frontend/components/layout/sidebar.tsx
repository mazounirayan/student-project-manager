"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { LogOut, Moon, Sun, X } from "lucide-react"
import { APP_NAME } from "@/lib/app"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { isNavActive, navFor } from "@/components/layout/nav"

interface SidebarProps {
  className?: string
  onNavigate?: () => void
  /** Affiche un bouton de fermeture (panneau mobile). */
  onClose?: () => void
}

const itemClass =
  "flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring"
const idleClass = "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const isDark = mounted && resolvedTheme === "dark"
  const Icon = isDark ? Sun : Moon

  return (
    <button
      type="button"
      className={cn(itemClass, idleClass)}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      <Icon aria-hidden="true" className="h-4 w-4" />
      {isDark ? "Passer en thème clair" : "Passer en thème sombre"}
    </button>
  )
}

export function Sidebar({ className, onNavigate, onClose }: SidebarProps) {
  const { user, logout } = useAuth()
  const pathname = usePathname()

  return (
    <div className={cn("flex h-full w-64 flex-col border-r border-sidebar-border bg-sidebar", className)}>
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-sidebar-border pl-6 pr-3">
        <Link
          href="/"
          onClick={onNavigate}
          className="rounded-sm text-base font-semibold leading-tight text-sidebar-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
        >
          {APP_NAME}
        </Link>
        {onClose && (
          <Button variant="ghost" size="icon" aria-label="Fermer la navigation" onClick={onClose}>
            <X aria-hidden="true" />
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-auto py-4">
        {user && (
          <div className="mb-4 px-6">
            <p className="truncate text-sm font-medium text-sidebar-foreground">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-xs text-sidebar-foreground/70">{user.role === "teacher" ? "Enseignant" : "Étudiant"}</p>
          </div>
        )}

        <nav aria-label="Navigation principale" className="space-y-1 px-3">
          {navFor(user?.role).map(({ href, label, icon: Icon }) => {
            const active = isNavActive(href, pathname)
            return (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(itemClass, active ? "bg-sidebar-primary text-sidebar-primary-foreground" : idleClass)}
              >
                <Icon aria-hidden="true" className="h-4 w-4" />
                {label}
              </Link>
            )
          })}
        </nav>
      </div>

      <div className="shrink-0 space-y-1 border-t border-sidebar-border p-3">
        <ThemeToggle />
        <button type="button" className={cn(itemClass, idleClass)} onClick={logout}>
          <LogOut aria-hidden="true" className="h-4 w-4" />
          Se déconnecter
        </button>
      </div>
    </div>
  )
}
