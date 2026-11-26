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
import { Plus } from "lucide-react"

interface CreatePromotionDialogProps {
  onCreatePromotion?: (promotion: { name: string; description: string; year: number }) => void
}

export function CreatePromotionDialog({ onCreatePromotion }: CreatePromotionDialogProps) {
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    year: new Date().getFullYear(),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim()) {
      return
    }

    onCreatePromotion?.(formData)

    setFormData({
      name: "",
      description: "",
      year: new Date().getFullYear(),
    })
    setOpen(false)
  }

  const handleInputChange = (field: string, value: string | number) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nouvelle promotion
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Créer une nouvelle promotion</DialogTitle>
          <DialogDescription>
            Ajoutez une nouvelle promotion pour organiser vos étudiants par année et filière.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nom de la promotion *</Label>
              <Input
                id="name"
                placeholder="ex: Master 2 Informatique"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Description de la promotion (optionnel)"
                value={formData.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
                rows={3}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="year">Année</Label>
              <Input
                id="year"
                type="number"
                min="2020"
                max="2030"
                value={formData.year}
                onChange={(e) => handleInputChange("year", Number.parseInt(e.target.value) || new Date().getFullYear())}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={!formData.name.trim()}>
              Créer la promotion
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
