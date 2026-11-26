"use client"

import { useEffect, useState, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Loader2, Menu } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { LoginForm } from "@/components/auth/login-form"
import { Sidebar } from "@/components/layout/sidebar"
import { currentNavItem } from "@/components/layout/nav"
import { DemoBanner } from "@/components/demo/demo-banner"

const APP_NAME = "Gestionnaire de projets"

export function MainLayout({ children }: { children: ReactNode }) {
  const { user, loading, isRefreshing } = useAuth()
  const pathname = usePathname()
  const [navOpen, setNavOpen] = useState(false)

  const section = currentNavItem(user?.role, pathname)?.label

  // Le titre de l’onglet suit la section courante (utile aussi aux lecteurs d’écran).
  useEffect(() => {
    document.title = user && section && section !== "Accueil" ? `${section} · ${APP_NAME}` : APP_NAME
  }, [user, section])

  // Referme le panneau mobile à chaque changement de page, et s’il n’a plus lieu d’être (écran élargi).
  useEffect(() => setNavOpen(false), [pathname])
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)")
    const close = () => query.matches && setNavOpen(false)
    query.addEventListener("change", close)
    return () => query.removeEventListener("change", close)
  }, [])

  if (loading) {
    return (
      <div role="status" className="flex min-h-screen items-center justify-center gap-2 text-muted-foreground">
        <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin text-primary" />
        Chargement…
      </div>
    )
  }

  if (!user) return <LoginForm />

  return (
    <div className="flex h-dvh flex-col bg-background lg:flex-row">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Aller au contenu
      </a>

      <DialogPrimitive.Root open={navOpen} onOpenChange={setNavOpen}>
        <header className="flex shrink-0 items-center gap-3 border-b bg-sidebar px-4 py-2 lg:hidden">
          <DialogPrimitive.Trigger
            aria-label="Ouvrir la navigation"
            className="-ml-2 flex h-10 w-10 items-center justify-center rounded-md text-sidebar-foreground outline-none hover:bg-sidebar-accent focus-visible:ring-[3px] focus-visible:ring-ring"
          >
            <Menu aria-hidden="true" className="h-5 w-5" />
          </DialogPrimitive.Trigger>
          <p className="truncate text-base font-semibold text-sidebar-foreground">{section ?? APP_NAME}</p>
        </header>

        <aside className="hidden shrink-0 lg:block">
          <Sidebar />
        </aside>

        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 lg:hidden" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed inset-y-0 left-0 z-50 max-w-[85vw] shadow-xl outline-none lg:hidden"
          >
            <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
            <Sidebar onNavigate={() => setNavOpen(false)} onClose={() => setNavOpen(false)} />
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      <main id="contenu" tabIndex={-1} className="relative min-w-0 flex-1 overflow-auto outline-none">
        <DemoBanner />
        {children}
        {isRefreshing && (
          <div role="status" className="absolute inset-0 z-40 flex items-center justify-center bg-background/60">
            <div className="flex items-center gap-2 rounded-lg border bg-card p-4 text-sm shadow-sm">
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              Mise à jour de la session…
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
