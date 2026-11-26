import Link from "next/link"
import type { ReactNode } from "react"
import { ArrowRight } from "lucide-react"
import { Card, CardAction, CardContent, CardDescription, CardHeader } from "@/components/ui/card"

interface SectionCardProps {
  title: string
  description?: string
  /** Lien « tout voir » affiché en haut à droite de la carte. */
  action?: { href: string; label: string }
  children: ReactNode
}

/** Carte standard d’une page : titre h2, description facultative, lien d’action, contenu. */
export function SectionCard({ title, description, action, children }: SectionCardProps) {
  return (
    <Card className="gap-4">
      <CardHeader>
        <h2 data-slot="card-title" className="leading-none font-semibold">
          {title}
        </h2>
        {description && <CardDescription>{description}</CardDescription>}
        {action && (
          <CardAction>
            <Link
              href={action.href}
              className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              {action.label}
              <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
            </Link>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
