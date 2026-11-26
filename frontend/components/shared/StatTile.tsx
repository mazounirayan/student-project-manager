import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface StatTileProps {
  label: string
  value: ReactNode
  /** Précision sous la valeur (« sur 3 groupes », « dans 10 jours »…). */
  hint?: string
  /** Met la valeur en avant quand elle demande une action. */
  emphasis?: boolean
}

/** Indicateur chiffré : valeur en grand, libellé au-dessus, précision en dessous. */
export function StatTile({ label, value, hint, emphasis }: StatTileProps) {
  return (
    <div className="rounded-xl border bg-card p-4 text-card-foreground shadow-sm">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular-nums", emphasis ? "text-primary" : "text-foreground")}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
