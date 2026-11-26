'use client'

import { BACKEND_URL, assertOk } from "@/lib/api"
import { toast } from "sonner"
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger
} from '@/components/ui/dialog'
import { Pencil } from 'lucide-react'

interface EditGradingGridDialogProps {
  grid: any
  onGridUpdated?: (updated: any) => void
}

export function EditGradingGridDialog({
  grid,
  onGridUpdated
}: EditGradingGridDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: grid.name,
    description: grid.description || '',
    type: grid.type || 'deliverable',
    weight: grid.weight || 1,
    deliverableId: grid.deliverableId
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(
        `${BACKEND_URL}/api/grading/grids/${grid.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(formData)
        }
      )

      await assertOk(response)

      const updated = await response.json()
      onGridUpdated?.(updated)
      setOpen(false)
    } catch (error) {
      toast.error('Erreur lors de la mise à jour de la grille.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="mr-2 h-4 w-4" />
          Modifier
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Modifier la grille</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Nom de la grille *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="type">Type *</Label>
              <Select
                value={formData.type}
                onValueChange={(value: any) =>
                  setFormData({ ...formData, type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deliverable">Livrable</SelectItem>
                  <SelectItem value="report">Rapport</SelectItem>
                  <SelectItem value="defense">Soutenance</SelectItem>
                </SelectContent>
              </Select>
            </div>

          
            <div className="grid gap-2">
              <Label htmlFor="weight">Poids *</Label>
              <Input
                id="weight"
                type="number"
                min="1"
                step="1"
                max={100}
                value={formData.weight * 100}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    weight: parseFloat(e.target.value) / 100
                  })
                }
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} type="button">
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Mise à jour...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
