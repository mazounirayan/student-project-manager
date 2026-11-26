"use client"

import { useMemo, useState, type FormEvent } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { computeSlots, formatDuration, startOf, type PlanSettings } from "@/lib/defenses"
import { errorMessage } from "@/lib/api"
import { formatDateFull, formatTime, plural } from "@/lib/format"

export interface SchedulePayload {
  startDateTime: string
  durationPerGroup: number
  breakMinutes: number
  location: string
  instructions: string
}

interface ScheduleDefenseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Groupes qui recevront un créneau, dans l’ordre de passage. */
  groups: { id: number; name: string }[]
  /** Réglages de départ : ceux du planning en cours, ou des valeurs courantes. */
  initial: PlanSettings
  /** Il existe déjà un planning : on le modifie. */
  editing: boolean
  /** Groupes déjà commencés ou passés, qui ne changent pas. */
  keptCount: number
  /** Renvoie false si l’enseignante renonce (par exemple à la confirmation) ; une erreur s’affiche dans le formulaire. */
  onSubmit: (payload: SchedulePayload) => Promise<boolean>
}

export function ScheduleDefenseDialog({ open, onOpenChange, ...props }: ScheduleDefenseDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        {/* Le formulaire est monté à chaque ouverture : il repart des réglages du planning. */}
        <ScheduleForm {...props} onCancel={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function ScheduleForm({ groups, initial, editing, keptCount, onSubmit, onCancel }: Omit<ScheduleDefenseDialogProps, "open" | "onOpenChange"> & { onCancel: () => void }) {
  const [settings, setSettings] = useState<PlanSettings>(initial)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof PlanSettings>(key: K, value: PlanSettings[K]) => setSettings((current) => ({ ...current, [key]: value }))

  const start = settings.date && settings.time ? startOf(settings) : null
  const validStart = start && !Number.isNaN(start.getTime()) ? start : null
  const slots = useMemo(
    () => (validStart && settings.duration > 0 ? computeSlots(validStart, settings.duration, Math.max(0, settings.pause || 0), groups.length) : []),
    [validStart, settings.duration, settings.pause, groups.length],
  )
  const last = slots[slots.length - 1]
  const inThePast = validStart !== null && validStart.getTime() < Date.now()

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!validStart) return
    setPending(true)
    setError(null)
    try {
      const saved = await onSubmit({
        startDateTime: validStart.toISOString(),
        durationPerGroup: settings.duration,
        breakMinutes: settings.pause || 0,
        location: settings.location.trim(),
        instructions: settings.instructions.trim(),
      })
      if (!saved) setPending(false)
    } catch (err) {
      setError(errorMessage(err, "Impossible d’enregistrer le planning."))
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <DialogHeader>
        <DialogTitle>{editing ? "Modifier le planning" : "Planifier les soutenances"}</DialogTitle>
        <DialogDescription>
          {editing && keptCount > 0
            ? `${plural(keptCount, "groupe")} ${keptCount > 1 ? "ont déjà commencé et ne changent" : "a déjà commencé et ne change"} pas. ${
                groups.length > 1 ? `Les ${groups.length} autres sont replanifiés` : "L’autre groupe est replanifié"
              }, dans l’ordre actuel.`
            : `${groups.length > 1 ? `Les ${groups.length} groupes passent` : "Le groupe passe"} l’un après l’autre, dans l’ordre indiqué plus bas. Vous pourrez ensuite changer l’ordre.`}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="defense-date">Date</Label>
          <Input id="defense-date" type="date" required value={settings.date} onChange={(event) => set("date", event.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="defense-time">Heure de début</Label>
          <Input id="defense-time" type="time" required value={settings.time} onChange={(event) => set("time", event.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="defense-duration">Durée par groupe (minutes)</Label>
          <Input
            id="defense-duration"
            type="number"
            required
            min={5}
            max={240}
            step={5}
            inputMode="numeric"
            value={settings.duration || ""}
            onChange={(event) => set("duration", Number(event.target.value))}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="defense-pause">Pause entre deux groupes (minutes)</Label>
          <Input
            id="defense-pause"
            type="number"
            min={0}
            max={120}
            step={5}
            inputMode="numeric"
            value={Number.isNaN(settings.pause) ? "" : settings.pause}
            onChange={(event) => set("pause", Number(event.target.value))}
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="defense-location">Lieu</Label>
        <Input id="defense-location" required value={settings.location} placeholder="Par exemple : Amphi B" onChange={(event) => set("location", event.target.value)} />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="defense-instructions">
          Consignes de préparation <span className="font-normal text-muted-foreground">(facultatif)</span>
        </Label>
        <Textarea
          id="defense-instructions"
          rows={3}
          maxLength={2000}
          value={settings.instructions}
          placeholder="Durée de l’exposé, démonstration attendue, documents à apporter…"
          aria-describedby="defense-instructions-hint"
          onChange={(event) => set("instructions", event.target.value)}
        />
        <p id="defense-instructions-hint" className="text-xs text-muted-foreground">
          Les étudiants le lisent avec leur créneau.
        </p>
      </div>

      <section aria-labelledby="defense-preview" className="rounded-md border bg-muted/40 p-3">
        <h3 id="defense-preview" className="text-sm font-medium">
          Créneaux calculés
        </h3>
        {slots.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">Indiquez la date, l’heure de début et la durée pour voir l’heure de chaque groupe.</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">
              {formatDateFull(slots[0].start)} · {formatDuration(settings.duration)} par groupe · fin prévue à {formatTime(last.end)}
            </p>
            <ol className="mt-2 max-h-44 space-y-1 overflow-y-auto pr-1 text-sm">
              {slots.map((slot, index) => (
                <li key={groups[index].id} className="flex flex-wrap justify-between gap-x-3">
                  <span>
                    <span className="tabular-nums text-muted-foreground">{keptCount + index + 1}.</span> {groups[index].name}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {formatTime(slot.start)} – {formatTime(slot.end)}
                  </span>
                </li>
              ))}
            </ol>
          </>
        )}
        {inThePast && <p className="mt-2 text-xs text-destructive">Ce début est déjà passé : les créneaux calculés le sont aussi.</p>}
      </section>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Annuler
        </Button>
        <Button type="submit" disabled={pending || !validStart || slots.length === 0}>
          {pending && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
          {editing ? "Enregistrer le planning" : "Planifier"}
        </Button>
      </DialogFooter>
    </form>
  )
}
