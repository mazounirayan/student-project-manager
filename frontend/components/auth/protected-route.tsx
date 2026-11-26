"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { Lock } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { MainLayout } from "@/components/layout/main-layout"
import { PageContainer } from "@/components/layout/page"
import { EmptyState } from "@/components/shared/EmptyState"
import { Button } from "@/components/ui/button"

interface ProtectedRouteProps {
  children: ReactNode
  roles?: Array<"teacher" | "student">
}

const ROLE_LABELS = { teacher: "aux enseignants", student: "aux étudiants" } as const

/**
 * Garde de rôle. Sans session, MainLayout affiche le chargement puis l’écran de connexion
 * (l’adresse reste la même). Avec un autre rôle, la page explique pourquoi elle est
 * inaccessible au lieu de rediriger sans un mot.
 */
export function ProtectedRoute({ children, roles = [] }: ProtectedRouteProps) {
  const { user, loading } = useAuth()

  if (loading || !user) return <MainLayout>{null}</MainLayout>

  if (roles.length > 0 && !roles.includes(user.role)) {
    return (
      <MainLayout>
        <PageContainer width="narrow">
          <EmptyState
            icon={Lock}
            title={`Cette page est réservée ${roles.map((role) => ROLE_LABELS[role]).join(" et ")}`}
            description="Votre compte n’y donne pas accès. Revenez à l’accueil pour retrouver vos pages."
            action={
              <Button asChild>
                <Link href="/">Retourner à l’accueil</Link>
              </Button>
            }
          />
        </PageContainer>
      </MainLayout>
    )
  }

  return <>{children}</>
}
