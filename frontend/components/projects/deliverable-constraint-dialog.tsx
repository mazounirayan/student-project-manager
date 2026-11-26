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
import { Settings } from "lucide-react"

interface DeliverableConstraintDialogProps {
  deliverableId?: number
  onConstraintAdded: (constraint: any) => void
}

export function DeliverableConstraintDialog({ deliverableId, onConstraintAdded }: DeliverableConstraintDialogProps) {
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState({
    type: "max_size",
    configuration: "",
    errorMessage: "",
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const constraintData = {
      ...formData,
      deliverableId,
    }

    onConstraintAdded(constraintData)
    setOpen(false)
    setFormData({
      type: "max_size",
      configuration: "",
      errorMessage: "",
    })
  }

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const getConfigurationPlaceholder = () => {
    switch (formData.type) {
      case "max_size":
        return "50 Mo"
      case "file_format":
        return "pdf, docx, zip"
      default:
        return "Configuration de la contrainte"
    }
  }

  const getDefaultErrorMessage = () => {
    switch (formData.type) {
      case "max_size":
        return "Le fichier dépasse la taille maximale autorisée"
      case "file_format":
        return "Format de fichier non autorisé"
      default:
        return "Contrainte non respectée"
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="mr-2 h-4 w-4" />
          Contraintes
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Ajouter une contrainte</DialogTitle>
          <DialogDescription>Définissez des règles de validation pour ce livrable.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="type">Type de contrainte</Label>
            <Select value={formData.type} onValueChange={(value) => handleInputChange("type", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionnez un type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="max_size">Taille maximale</SelectItem>
                <SelectItem value="file_format">Format de fichier</SelectItem>
                <SelectItem value="folder_structure">Structure de dossiers</SelectItem>
                <SelectItem value="file_content">Contenu de fichier</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="configuration">Configuration</Label>
            <Input
              id="configuration"
              value={formData.configuration}
              onChange={(e) => handleInputChange("configuration", e.target.value)}
              placeholder={getConfigurationPlaceholder()}
              required
            />
            <p className="text-xs text-muted-foreground">
              {formData.type === "max_size" && "Indiquez la taille avec son unité (Mo ou Go)."}
              {formData.type === "file_format" && "Extensions autorisées, séparées par des virgules."}
              {formData.type === "folder_structure" && "Structure attendue, au format JSON."}
              {formData.type === "file_content" && "Fichier et motif attendus, au format JSON."}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="errorMessage">Message d’erreur</Label>
            <Textarea
              id="errorMessage"
              value={formData.errorMessage}
              onChange={(e) => handleInputChange("errorMessage", e.target.value)}
              placeholder={getDefaultErrorMessage()}
              rows={2}
              required
            />
            <p className="text-xs text-muted-foreground">
              Affiché à l’étudiant si la contrainte n’est pas respectée.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit">Ajouter la contrainte</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
