"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Calendar, Clock } from "lucide-react"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToast } from "@/components/ui/use-toast"

interface ScheduleDefenseDialogProps {
  projectId: string
  groupCount: number
  onDefenseScheduled: (defenseData: {
    startDateTime: string
    endDateTime?: string
    durationPerGroup?: number
    location: string
  }) => void
}

export function ScheduleDefenseDialog({
  projectId,
  groupCount,
  onDefenseScheduled,
}: ScheduleDefenseDialogProps) {
  const [open, setOpen] = useState(false)
  const [startDate, setStartDate] = useState("")
  const [startTime, setStartTime] = useState("")
  const [endDate, setEndDate] = useState("")
  const [endTime, setEndTime] = useState("")
  const [location, setLocation] = useState("")
  const [durationPerGroup, setDurationPerGroup] = useState(30)
  const [scheduleMode, setScheduleMode] = useState<"duration" | "timeRange">("duration")
  const { toast } = useToast()

  const calculateDurationPerGroup = () => {
    if (!startDate || !startTime || !endTime || groupCount === 0) return 0

    const start = new Date(`${startDate}T${startTime}`)
    let end = new Date(`${endDate || startDate}T${endTime}`)
    if (end <= start) end = new Date(end.getTime() + 24 * 60 * 60 * 1000)

    const totalMinutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60))
    if (totalMinutes <= 0) return 0
    return Math.floor(totalMinutes / groupCount)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!startDate || !startTime || !location) {
      toast({
        title: "Champs manquants",
        description: "Veuillez remplir la date, l'heure de début et le lieu.",
        variant: "destructive",
      })
      return
    }

    const startDateTime = new Date(`${startDate}T${startTime}`).toISOString()

    if (scheduleMode === "duration") {
      if (!durationPerGroup || durationPerGroup <= 0) return
      onDefenseScheduled({
        startDateTime,
        durationPerGroup,
        location,
      })
    } else {
      if (!endTime) return
      let end = new Date(`${endDate || startDate}T${endTime}`)
      const start = new Date(`${startDate}T${startTime}`)
      if (end <= start) end = new Date(end.getTime() + 24 * 60 * 60 * 1000)
      const endDateTime = end.toISOString()
      onDefenseScheduled({
        startDateTime,
        endDateTime,
        location,
      })
    }

    setOpen(false)
    setStartDate("")
    setStartTime("")
    setEndDate("")
    setEndTime("")
    setLocation("")
    setDurationPerGroup(30)
  }

  const calculatedDuration = scheduleMode === "timeRange" ? calculateDurationPerGroup() : null
  const totalDuration =
    scheduleMode === "timeRange" && startDate && startTime && (endDate || startDate) && endTime
      ? Math.floor(
          ((new Date(`${endDate || startDate}T${endTime}`).getTime() -
            new Date(`${startDate}T${startTime}`).getTime() +
            (new Date(`${endDate || startDate}T${endTime}`) <= new Date(`${startDate}T${startTime}`)
              ? 24 * 60 * 60 * 1000
              : 0)) /
            (1000 * 60))
        )
      : null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Calendar className="mr-2 h-4 w-4" />
          Planifier les soutenances
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-2 border-b border-muted">
          <DialogTitle>Planifier les soutenances</DialogTitle>
          <DialogDescription>
            Choisissez le mode de planification et définissez les paramètres.
            {groupCount > 0 &&
              ` (${groupCount} groupe${groupCount > 1 ? "s" : ""} inscrit${groupCount > 1 ? "s" : ""})`}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1 px-1">
          <form onSubmit={handleSubmit} id="schedule-form">
            <div className="grid gap-4 py-4">
              {/* Mode de planification */}
              <div className="grid gap-3">
                <Label>Mode de planification</Label>
                <RadioGroup
                  value={scheduleMode}
                  onValueChange={(v) => setScheduleMode(v as "duration" | "timeRange")}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="duration" id="duration" />
                    <Label htmlFor="duration" className="font-normal cursor-pointer">
                      Date/heure de début + durée par groupe
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="timeRange" id="timeRange" />
                    <Label htmlFor="timeRange" className="font-normal cursor-pointer">
                      Plage horaire (durée calculée automatiquement)
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Date et heure de début */}
              <div className="grid gap-2">
                <Label htmlFor="startDate">Date de début</Label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="startTime">Heure de début</Label>
                <div className="relative">
                  <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="startTime"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              {/* Si mode durée */}
              {scheduleMode === "duration" && (
                <div className="grid gap-2">
                  <Label htmlFor="duration">Durée par groupe (minutes)</Label>
                  <Input
                    id="duration"
                    type="number"
                    min="10"
                    max="180"
                    step="5"
                    value={durationPerGroup}
                    onChange={(e) => setDurationPerGroup(Number(e.target.value))}
                    placeholder="30"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Durée recommandée : 20-45 minutes par groupe
                  </p>
                </div>
              )}

              {/* Si mode plage horaire */}
              {scheduleMode === "timeRange" && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="endDate">Date de fin</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="endDate"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="endTime">Heure de fin</Label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="endTime"
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  {calculatedDuration !== null && totalDuration !== null && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="space-y-1 text-sm">
                        <p>
                          <strong>Durée totale :</strong> {totalDuration} minutes
                        </p>
                        <p>
                          <strong>Nombre de groupes :</strong> {groupCount}
                        </p>
                        <p className={calculatedDuration < 15 ? "text-red-600 font-semibold" : ""}>
                          <strong>Durée par groupe :</strong> {calculatedDuration} minutes
                        </p>
                        {calculatedDuration < 15 && (
                          <p className="text-xs text-red-600 mt-2">
                            ⚠️ Attention : La durée par groupe est très courte. Augmentez la plage horaire.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Lieu */}
              <div className="grid gap-2">
                <Label htmlFor="location">Lieu</Label>
                <Input
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Ex: Salle A101"
                  required
                />
              </div>

              {/* Aperçu */}
              {startDate && startTime && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <h4 className="text-sm font-medium mb-2">Aperçu de la planification</h4>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p>
                      <strong>Début :</strong>{" "}
                      {new Date(`${startDate}T${startTime}`).toLocaleString("fr-FR", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>

                    {scheduleMode === "duration" && (
                      <p>
                        <strong>Durée par groupe :</strong> {durationPerGroup} minutes
                      </p>
                    )}

                    {scheduleMode === "timeRange" && endTime && (
                      <p>
                        <strong>Fin :</strong>{" "}
                        {new Date(`${endDate || startDate}T${endTime}`).toLocaleString("fr-FR", {
                          weekday: "long",
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    )}

                    <p>
                      <strong>Lieu :</strong> {location || "—"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Les créneaux seront automatiquement attribués aux groupes selon l'ordre
                      d'inscription.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </form>
        </div>

        <DialogFooter className="mt-4">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Annuler
          </Button>
          <Button type="submit" form="schedule-form">
            Planifier les soutenances
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
