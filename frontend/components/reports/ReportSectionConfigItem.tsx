// components/reports/ReportSectionConfigItem.tsx
'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Trash2, GripVertical, ArrowUp, ArrowDown } from 'lucide-react'
import type { ReportSectionConfig } from './TeacherReportConfig'

interface ReportSectionConfigItemProps {
  section: ReportSectionConfig
  index: number
  onUpdate: (updates: Partial<ReportSectionConfig>) => void
  onRemove: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
}

export function ReportSectionConfigItem({
  section,
  index,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown
}: ReportSectionConfigItemProps) {
  return (
    <div className="p-4 border rounded-lg space-y-4 bg-card">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3 flex-1">
          <div className="flex flex-col gap-1">
            <Button variant="ghost" size="icon" onClick={onMoveUp} disabled={!onMoveUp}>
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onMoveDown} disabled={!onMoveDown}>
              <ArrowDown className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex-1 space-y-4">
            {/* Titre de la section */}
            <div className="space-y-2">
              <Label htmlFor={`section-title-${index}`}>Titre de la section</Label>
              <Input
                id={`section-title-${index}`}
                value={section.title}
                onChange={(e) => onUpdate({ title: e.target.value })}
                placeholder="Ex: Introduction, Méthodologie, Résultats..."
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor={`section-desc-${index}`}>Description et consignes</Label>
              <Textarea
                id={`section-desc-${index}`}
                value={section.description}
                onChange={(e) => onUpdate({ description: e.target.value })}
                placeholder="Décrivez ce que les étudiants doivent écrire dans cette section..."
                rows={3}
              />
            </div>

            {/* Configuration */}
            <div className="grid grid-cols-2 gap-4">
              {/* Section obligatoire */}
              <div className="flex items-center space-x-2">
                <Switch
                  checked={section.required}
                  onCheckedChange={(required) => onUpdate({ required })}
                />
                <Label htmlFor={`section-required-${index}`}>Section obligatoire</Label>
              </div>

              {/* Limite de mots */}
              <div className="space-y-2">
                <Label htmlFor={`section-wordlimit-${index}`}>Limite de mots (optionnel)</Label>
                <Input
                  id={`section-wordlimit-${index}`}
                  type="number"
                  value={section.wordLimit || ''}
                  onChange={(e) => onUpdate({ 
                    wordLimit: e.target.value ? parseInt(e.target.value) : undefined 
                  })}
                  placeholder="Ex: 500"
                />
              </div>
            </div>
          </div>
        </div>

        <Button variant="ghost" size="icon" onClick={onRemove} className="text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}