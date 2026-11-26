"use client"

import { FlaskConical, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { confirmAction } from "@/lib/dialogs"
import { resetDemoDb } from "@/lib/demo/store"
import { STATIC_DEMO } from "@/lib/demo/mode"

/**
 * Bandeau discret indiquant que les données affichées sont fictives,
 * avec un bouton de réinitialisation de la démo.
 */
export function DemoBanner() {
  if (!STATIC_DEMO) return null

  const reset = async () => {
    const confirmed = await confirmAction({
      title: "Réinitialiser la démo ?",
      description: "Les modifications faites dans cette démo seront effacées et les données fictives de départ reviendront. Vous serez déconnecté.",
      confirmText: "Réinitialiser",
      destructive: true,
    })
    if (!confirmed) return
    resetDemoDb()
    // Les jetons et la session référencent l’ancienne base : retour à l’écran de connexion.
    for (const key of ["token", "refreshToken", "user", "lastGradesView"]) window.localStorage.removeItem(key)
    window.location.href = window.location.pathname
  }

  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 border-b border-border bg-secondary/60 px-4 py-1.5 text-xs text-secondary-foreground"
    >
      <p className="flex min-w-0 items-center gap-2">
        <FlaskConical aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span>Démo : données fictives, enregistrées dans votre navigateur.</span>
      </p>
      <Button variant="outline" size="sm" className="h-7 shrink-0 px-2 text-xs" onClick={reset}>
        <RotateCcw aria-hidden="true" className="h-3 w-3" />
        Réinitialiser
      </Button>
    </div>
  )
}
