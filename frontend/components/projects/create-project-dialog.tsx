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
import { Plus } from "lucide-react"

interface CreateProjectDialogProps {
  onProjectCreated?: (project: any) => void
  promotions: any[]
}

export function CreateProjectDialog({ onProjectCreated, promotions }: CreateProjectDialogProps) {
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    promotionId: undefined as number | undefined,
    minGroupSize: 2,
    maxGroupSize: 5,
    groupFormationRule: "free" as "manual" | "random" | "free",
    status: "draft" as "draft" | "visible",
    groupFormationDeadline: "",
  })

  const selectedPromotion = promotions?.find(
    (p) => p.id === (formData.promotionId ?? NaN)
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const newProject = {
      name: formData.name,
      description: formData.description,
      promotionId: formData.promotionId,
      minGroupSize: formData.minGroupSize,
      maxGroupSize: formData.maxGroupSize,
      groupFormationRule: formData.groupFormationRule,
      status: formData.status,
      groupFormationDeadline: formData.groupFormationDeadline,
    }

    onProjectCreated?.(newProject)
    setOpen(false)
    setFormData({
      name: "",
      description: "",
      promotionId: undefined,
      status: "draft",
      groupFormationRule: "free",
      minGroupSize: 2,
      maxGroupSize: 5,
      groupFormationDeadline: "",
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nouveau projet
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Créer un nouveau projet</DialogTitle>
          <DialogDescription>Configurez les paramètres de votre nouveau projet étudiant</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom du projet *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Application de gestion de bibliothèque"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Décrivez les objectifs et le contexte du projet..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="promotion">Promotion *</Label>
                <Select
                  value={formData.promotionId !== undefined ? String(formData.promotionId) : undefined}
                  onValueChange={(value) => setFormData({ ...formData, promotionId: Number(value) })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une promotion" />
                  </SelectTrigger>
                  <SelectContent>
                    {promotions?.map((promo) => (
                      <SelectItem key={promo.id} value={promo.id}>
                        {promo.name} ({promo.year})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedPromotion ? (
                  <div className="mt-2 rounded-md border p-3 text-sm">
                    <div className="font-medium">
                      {selectedPromotion.name} — {selectedPromotion.year}
                    </div>
                    <div className="text-muted-foreground">
                      {selectedPromotion.students?.length ?? 0} étudiant(s)
                      {selectedPromotion.projects?.length != null && (
                        <> • {selectedPromotion.projects.length} projet(s)</>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mt-1 text-xs text-muted-foreground">Aucune promotion sélectionnée</div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Statut</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: "draft" | "visible") => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Brouillon</SelectItem>
                    <SelectItem value="visible">Visible aux étudiants</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4 border-t pt-4">
              {/* <div className="flex items-center space-x-2">
                <Switch
                  id="group-project"
                  checked={formData.isGroupProject}
                  onCheckedChange={(checked) => setFormData({ ...formData, isGroupProject: checked })}
                />
                <Label htmlFor="group-project">Projet en groupe</Label>
              </div> */}

              <div className="space-y-4 pl-6 border-l-2 border-muted">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="min-size">Taille min du groupe</Label>
                    <Input
                      id="min-size"
                      type="number"
                      min="1"
                      max="10"
                      value={formData.minGroupSize}
                      onChange={(e) => setFormData({ ...formData, minGroupSize: Number.parseInt(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="max-size">Taille max du groupe</Label>
                    <Input
                      id="max-size"
                      type="number"
                      min="1"
                      max="10"
                      value={formData.maxGroupSize}
                      onChange={(e) => setFormData({ ...formData, maxGroupSize: Number.parseInt(e.target.value) })}
                    />
                  </div>
                </div>

                {/* <div className="space-y-2">
                    <Label htmlFor="formation">Formation des groupes</Label>
                    <Select
                      value={formData.groupFormationRule}
                      onValueChange={(value: "manual" | "random" | "free") =>
                        setFormData({ ...formData, groupFormationRule: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="free">Libre (étudiants choisissent)</SelectItem>
                        <SelectItem value="manual">Manuel (enseignant assigne)</SelectItem>
                        <SelectItem value="random">Aléatoire</SelectItem>
                      </SelectContent>
                    </Select>
                  </div> */}

                {/* {formData.groupFormationRule === "free" && (
                    <div className="space-y-2">
                      <Label htmlFor="deadline">Date limite de formation</Label>
                      <Input
                        id="deadline"
                        type="datetime-local"
                        value={formData.groupDeadline}
                        onChange={(e) => setFormData({ ...formData, groupDeadline: e.target.value })}
                      />
                    </div>
                  )} */}
              </div>
            </div>
            <div className="space-y-4 pl-6 border-l-2 border-muted">
                <div className="space-y-2">
                  <Label htmlFor="status">Formation des groupes</Label>
                  <Select
                    value={formData.groupFormationRule}
                    onValueChange={(value: "manual" | "random" | "free") => setFormData({ ...formData, groupFormationRule: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manuel</SelectItem>
                      <SelectItem value="random">Aléatoire</SelectItem>
                      <SelectItem value="free">Libre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="deadline">Date limite de formation</Label>
                  <Input
                    id="deadline"
                    type="datetime-local"
                    value={formData.groupFormationDeadline}
                    onChange={(e) => setFormData({ ...formData, groupFormationDeadline: e.target.value })}
                  />
                </div>
              </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit">Créer le projet</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
