"use client"

import type React from "react"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Edit } from "lucide-react"

interface Promotion {
  id: string
  name: string
  description?: string
  year: string
}

interface EditPromotionDialogProps {
  promotion: Promotion
  onEditPromotion: (promotionData: { name: string; description: string; year: number }) => void
  trigger?: React.ReactNode
}

export function EditPromotionDialog({ promotion, onEditPromotion, trigger }: EditPromotionDialogProps) {
  const [open, setOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: promotion.name,
    description: promotion.description || "",
    year: promotion.year,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim() || !formData.year) {
      return
    }

    // Convert year string to number (extract first year from format like "2024-2025")
    const yearNumber = Number.parseInt(formData.year)

    onEditPromotion({
      name: formData.name.trim(),
      description: formData.description.trim(),
      year: yearNumber,
    })

    setOpen(false)
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Edit className="mr-2 h-4 w-4" />
            Modifier
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Modifier la promotion</DialogTitle>
          <DialogDescription>Modifiez les informations de la promotion</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Nom de la promotion *</Label>
            <Input
              id="edit-name"
              placeholder="Ex: Master 2 Informatique"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-description">Description</Label>
            <Textarea
              id="edit-description"
              placeholder="Description de la promotion..."
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-year">Année académique *</Label>
            <Input
              id="edit-year"
              placeholder="Ex: 2024-2025"
              value={formData.year}
              onChange={(e) => handleInputChange("year", e.target.value)}
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit">Enregistrer les modifications</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
