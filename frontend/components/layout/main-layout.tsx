"use client"
import { useAuth } from "@/contexts/auth-context"
import { LoginForm } from "@/components/auth/login-form"
import { Sidebar } from "@/components/layout/sidebar"
import { Loader2, Menu } from "lucide-react"
import { useEffect, useState } from "react"
import { DemoBanner } from "@/components/demo/demo-banner"

interface MainLayoutProps {
  children: React.ReactNode
}

export function MainLayout({ children }: MainLayoutProps) {
  const { user, loading, isRefreshing } = useAuth()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // Referme le menu mobile à chaque changement de page.
  useEffect(() => {
    setMobileNavOpen(false)
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
        <span className="ml-2 text-lg">Chargement…</span>
      </div>
    )
  }

  if (isRefreshing) {
    return (
      <div className="flex h-screen bg-background">
        <div className="hidden lg:block">
          <Sidebar />
        </div>
        <main className="flex-1 overflow-auto relative">
          <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-50">
            <div className="flex flex-wrap items-center gap-2 bg-card p-4 rounded-lg shadow-sm">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span className="text-sm">Mise à jour de la session…</span>
            </div>
          </div>
          {children}
        </main>
      </div>
    )
  }

  if (!user) {
    return <LoginForm />
  }

  return (
    <div className="flex h-screen flex-col bg-background lg:flex-row">
      <header className="flex flex-wrap items-center gap-2 border-b bg-sidebar px-4 py-3 lg:hidden">
        <button
          type="button"
          aria-label="Ouvrir la navigation"
          aria-expanded={mobileNavOpen}
          className="rounded-md border p-2 text-sidebar-foreground"
          onClick={() => setMobileNavOpen((open) => !open)}
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <span className="text-sm font-semibold text-sidebar-foreground">Gestionnaire de projets</span>
      </header>

      {/* Navigation latérale (desktop) ou panneau coulissant (mobile) */}
      <aside className="hidden lg:block">
        <Sidebar />
      </aside>
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Fermer la navigation"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 shadow-xl">
            <Sidebar onNavigate={() => setMobileNavOpen(false)} />
          </div>
        </div>
      )}

      <main className="flex-1 overflow-auto">
        <DemoBanner />
        {children}
      </main>
    </div>
  )
}
