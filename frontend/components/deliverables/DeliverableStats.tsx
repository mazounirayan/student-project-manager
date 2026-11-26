import { summarize, type Deliverable, type GroupRef } from "@/lib/deliverables"
import { plural } from "@/lib/format"

interface DeliverableStatsProps {
  deliverable: Deliverable
  groups: GroupRef[]
}

/** Bilan d’un livrable en une ligne : qui a rendu, puis seulement ce qui demande un regard. */
export function DeliverableStats({ deliverable, groups }: DeliverableStatsProps) {
  const stats = summarize(deliverable, groups)
  const alerts = [
    stats.missing > 0 && `${plural(stats.missing, "groupe")} sans rendu`,
    stats.late > 0 && `${plural(stats.late, "rendu")} en retard`,
    stats.nonCompliant > 0 && `${plural(stats.nonCompliant, "rendu")} non conforme${stats.nonCompliant > 1 ? "s" : ""}`,
    stats.flagged > 0 && `${plural(stats.flagged, "rendu")} à vérifier (ressemblance)`,
  ].filter((text): text is string => Boolean(text))

  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
      <li className="font-medium tabular-nums">
        {stats.groups === 0 ? "Aucun groupe" : `${stats.received} sur ${plural(stats.groups, "groupe")} ${stats.received > 1 ? "ont" : "a"} rendu`}
      </li>
      {alerts.map((text) => (
        <li key={text} className="tabular-nums text-destructive">
          {text}
        </li>
      ))}
      {stats.received >= 2 && stats.analysed === 0 && <li className="text-muted-foreground">Ressemblance non analysée</li>}
    </ul>
  )
}
