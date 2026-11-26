import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

const WIDTHS = { narrow: "max-w-3xl", default: "max-w-6xl", wide: "max-w-7xl" } as const

interface PageContainerProps {
  children: ReactNode
  width?: keyof typeof WIDTHS
  className?: string
}

/** Conteneur de page : largeur maximale et marges identiques sur tous les écrans de l’application. */
export function PageContainer({ children, width = "default", className }: PageContainerProps) {
  return <div className={cn("mx-auto w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8", WIDTHS[width], className)}>{children}</div>
}

interface PageHeaderProps {
  title: string
  description?: ReactNode
  /** Boutons d’action principaux, alignés à droite (sous le titre sur mobile). */
  actions?: ReactNode
}

/** En-tête de page : un seul h1 par page, une ligne de contexte, les actions principales. */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-x-6 gap-y-3 sm:mb-8">
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1>
        {description && <p className="text-sm text-muted-foreground sm:text-base">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
