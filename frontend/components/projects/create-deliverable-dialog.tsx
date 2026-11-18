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
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Plus } from "lucide-react"

interface CreateDeliverableDialogProps {
  projectId: string
  onDeliverableCreated: (deliverable: any) => void
}

export function CreateDeliverableDialog({ projectId, onDeliverableCreated }: CreateDeliverableDialogProps) {
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "archive",
    deadline: "",
    allowLateSubmission: true,
    penaltyPerHour: 0,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const deliverableData = {
      ...formData,
      projectId: Number.parseInt(projectId),
      deadline: new Date(formData.deadline).toISOString(),
    }
    onDeliverableCreated(deliverableData)
    setOpen(false)
    setFormData({
      name: "",
      description: "",
      type: "archive",
      deadline: "",
      allowLateSubmission: true,
      penaltyPerHour: 1,
    })
  }

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2 shadow-sm">
          <Plus className="h-4 w-4" />
          Créer un livrable
        </Button>
      </DialogTrigger>

      <DialogContent
        className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800"
      >
        <DialogHeader className="border-b pb-3 sticky top-0 bg-white dark:bg-neutral-900 z-10">
          <DialogTitle className="text-lg font-semibold text-neutral-800 dark:text-neutral-100">
            Créer un nouveau livrable
          </DialogTitle>
          <DialogDescription className="text-sm text-neutral-500 dark:text-neutral-400">
            Ajoutez un nouveau livrable avec ses paramètres et contraintes.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-2  break-words">
          <div className="space-y-2">
            <Label htmlFor="name">Nom du livrable</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              placeholder="ex: Livrable 1 - Analyse"
              required
              className="focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Document d'analyse du projet"
              rows={3}
              required
              className="resize-none focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>

          {/* Type */}
          <div className="space-y-2">
            <Label htmlFor="type">Type de livrable</Label>
            <Select value={formData.type} onValueChange={(value) => handleInputChange("type", value)}>
              <SelectTrigger className="focus:ring-2 focus:ring-primary focus:border-primary">
                <SelectValue placeholder="Sélectionnez un type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="archive">Archive (.zip, .rar...)</SelectItem>
                <SelectItem value="git_link">Lien GitHub</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date limite */}
          <div className="space-y-2">
            <Label htmlFor="deadline">Date limite</Label>
            <Input
              id="deadline"
              type="datetime-local"
              value={formData.deadline}
              onChange={(e) => handleInputChange("deadline", e.target.value)}
              required
              className="focus:ring-2 focus:ring-primary focus:border-primary"
            />
          </div>

          {/* Soumission tardive */}
          <div className="flex items-start justify-between border-t pt-4">
            <div className="space-y-0.5">
              <Label htmlFor="allowLateSubmission" className="font-medium">
                Autoriser les soumissions tardives
              </Label>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Permet aux étudiants de soumettre après la date limite.
              </p>
            </div>
            <Switch
              id="allowLateSubmission"
              checked={formData.allowLateSubmission}
              onCheckedChange={(checked) => handleInputChange("allowLateSubmission", checked)}
            />
          </div>

          {/* Pénalité */}
          {formData.allowLateSubmission && (
            <div className="space-y-2">
              <Label htmlFor="penaltyPerHour">Pénalité par heure de retard (%)</Label>
              <Input
                id="penaltyPerHour"
                type="number"
                min="0"
                step="0.1"
                value={formData.penaltyPerHour}
                onChange={(e) => handleInputChange("penaltyPerHour", Number.parseFloat(e.target.value))}
                placeholder="1"
                className="focus:ring-2 focus:ring-primary focus:border-primary"
              />
            </div>
          )}

          {/* Boutons */}
          <DialogFooter className="pt-3 border-t mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="w-full sm:w-auto"
            >
              Annuler
            </Button>
            <Button type="submit" className="w-full sm:w-auto">
              Créer le livrable
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
