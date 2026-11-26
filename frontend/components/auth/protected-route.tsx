"use client"

import { useEffect, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"

interface ProtectedRouteProps {
  children: ReactNode
  roles?: Array<"teacher" | "student">
}

/**
 * Garde de rôle : redirige vers l’accueil si l’utilisateur n’est pas autorisé.
 * La redirection est différée d’un court instant et annulable : l’état
 * d’authentification est restauré de façon asynchrone (localStorage + vérification
 * du jeton) au chargement d’une page protégée, et un rendu intermédiaire peut
 * encore afficher user=null avant que la session ne soit rétablie.
 */
export function ProtectedRoute({ children, roles = [] }: ProtectedRouteProps) {
  const { user, loading } = useAuth()
  const router = useRouter()

  const unauthorized = !loading && (!user || (roles.length > 0 && !roles.includes(user.role)))

  useEffect(() => {
    if (!unauthorized) return
    const timer = window.setTimeout(() => {
      router.push("/")
    }, 500)
    return () => window.clearTimeout(timer)
  }, [unauthorized, router])

  if (loading || unauthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="text-muted-foreground">Chargement…</span>
      </div>
    )
  }

  return <>{children}</>
}
