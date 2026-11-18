"use client"

import { FlaskConical, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { resetDemoDb } from "@/lib/demo/store"
import { DEMO_ACCOUNTS, STATIC_DEMO } from "@/lib/demo/mode"

/**
 * Bandeau discret indiquant que les données affichées sont fictives,
 * avec un bouton de réinitialisation de la démo.
 */
export function DemoBanner() {
  if (!STATIC_DEMO) return null

  const reset = () => {
    resetDemoDb()
    // Les jetons et la session référencent l'ancienne base : retour à l'écran de connexion.
    window.localStorage.removeItem("token")
    window.localStorage.removeItem("refreshToken")
    window.localStorage.removeItem("user")
    window.localStorage.removeItem("lastGradesView")
    window.location.href = window.location.pathname
  }

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-secondary/60 px-4 py-1.5 text-xs text-secondary-foreground"
    >
      <p className="flex items-center gap-2">
        <FlaskConical aria-hidden="true" className="h-3.5 w-3.5 text-primary" />
        <span>
          Démo : données fictives stockées dans votre navigateur — comptes{" "}
          <span className="font-medium">{DEMO_ACCOUNTS.teacher.name}</span> et{" "}
          <span className="font-medium">{DEMO_ACCOUNTS.student.name}</span>.
        </span>
      </p>
      <Button variant="outline" size="sm" className="h-6 px-2 text-xs" onClick={reset}>
        <RotateCcw aria-hidden="true" className="mr-1 h-3 w-3" />
        Réinitialiser la démo
      </Button>
    </div>
  )
}
