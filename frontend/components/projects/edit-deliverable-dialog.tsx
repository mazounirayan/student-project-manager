"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { Trash2, Plus } from "lucide-react"

const NEST_BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'

interface DeliverableRule {
  id?: number
  type: 'max_size' | 'file_presence' | 'folder_structure' | 'file_content'
  configuration: string
}

interface EditDeliverableDialogProps {
  deliverable: any
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeliverableUpdated: (deliverable: any) => void
}

export function EditDeliverableDialog({
  deliverable,
  open,
  onOpenChange,
  onDeliverableUpdated,
}: EditDeliverableDialogProps) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    type: "archive" as "archive" | "git_link",
    deadline: "",
    allowLateSubmission: true,
    penaltyPerHour: 1,
  })

  const [rules, setRules] = useState<DeliverableRule[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (deliverable) {
      const deadlineDate = new Date(deliverable.deadline)
      const formattedDeadline = deadlineDate.toISOString().slice(0, 16)

      setFormData({
        name: deliverable.name || "",
        description: deliverable.description || "",
        type: deliverable.type || "archive",
        deadline: formattedDeadline,
        allowLateSubmission: deliverable.allowLateSubmission ?? true,
        penaltyPerHour: deliverable.penaltyPerHour || 1,
        
      })

      if (Array.isArray(deliverable.validationRules)) {
        setRules(deliverable.validationRules.map((rule: any) => ({
          id: rule.id,
          type: rule.type,
          configuration: rule.configuration
        })))
      }
    }
  }, [deliverable])

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const addRule = () => {
    setRules([...rules, { type: 'max_size', configuration: '{}' }])
  }

  const updateRule = (index: number, field: keyof DeliverableRule, value: any) => {
    const newRules = [...rules]
    newRules[index] = { ...newRules[index], [field]: value }
    setRules(newRules)
  }

  const deleteRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index))
  }

  const getRuleConfig = (rule: DeliverableRule): any => {
    try {
      return JSON.parse(rule.configuration)
    } catch {
      return {}
    }
  }

  const setRuleConfig = (index: number, config: any) => {
    updateRule(index, 'configuration', JSON.stringify(config))
  }

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  setIsSubmitting(true)
  const oldRules = deliverable.validationRules || []
const newRules = rules
const toDelete = oldRules.filter((or: { id: number | undefined }) => !newRules.some(nr => nr.id === or.id))

const toCreate = newRules.filter(nr => !nr.id)

const toUpdate = newRules.filter(nr => {
  const old = oldRules.find((or: { id: number | undefined }) => or.id === nr.id)
  if (!old) return false
  return (
    old.type !== nr.type ||
    old.configuration !== nr.configuration
  )
})
  try {
    const token = localStorage.getItem("token")
    if (!token) throw new Error("Non authentifié")
let payload = JSON.stringify({
        name: formData.name,
        description: formData.description,
        type: formData.type,
        deadline: new Date(formData.deadline).toISOString(),
        allowLateSubmission: formData.allowLateSubmission,
        penaltyPerHour: formData.penaltyPerHour,
        projectId: deliverable.project?.id || deliverable.projectId || 0, // 🔧 AJOUT MANQUANT
      })

    const res = await fetch(`${NEST_BACKEND_URL}/api/deliverables/${deliverable.id}`, {
      method: "PUT",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: payload,
    })

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      throw new Error(errorData.error || "Erreur de mise à jour du livrable")
    }

    
    const oldRuleIds = deliverable.validationRules
      ?.filter((r: any) => r.id)
      .map((r: any) => r.id) || []

await Promise.all(
  toDelete.map((rule: { id: any }) =>
    fetch(`${NEST_BACKEND_URL}/api/deliverables/${deliverable.id}/rules/${rule.id}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${token}` }
    })
  )
)


await Promise.all(
  toCreate.map(rule =>
    fetch(`${NEST_BACKEND_URL}/api/deliverables/${deliverable.id}/rules`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        type: rule.type,
        configuration: JSON.parse(rule.configuration),  
      }),
    })
  )
)


await Promise.all(
  toUpdate.map(rule =>
    fetch(`${NEST_BACKEND_URL}/api/deliverables/${deliverable.id}/rules/${rule.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        type: rule.type,
        configuration: rule.configuration,
      }),
    })
  )
)

   toast.success("Livrable mis à jour avec succès ✅")
onDeliverableUpdated({ ...deliverable, ...formData, validationRules: rules })
onOpenChange(false)

  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Échec de la mise à jour du livrable ❌")
  } finally {
    setIsSubmitting(false)
  }
}

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier le livrable</DialogTitle>
          <DialogDescription>Modifiez les paramètres et les règles de vérification.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* --- Informations générales --- */}
          <div className="space-y-2">
            <Label htmlFor="name">Nom du livrable</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              placeholder="ex: Livrable 1 - Analyse"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Document d'analyse du projet"
              rows={3}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Type de livrable</Label>
            <Select value={formData.type} onValueChange={(v) => handleInputChange("type", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionnez un type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="archive">Archive à uploader</SelectItem>
                <SelectItem value="git_link">Lien Git public</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="deadline">Date limite</Label>
            <Input
              id="deadline"
              type="datetime-local"
              value={formData.deadline}
              onChange={(e) => handleInputChange("deadline", e.target.value)}
              required
            />
          </div>

          {/* --- Retard --- */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="allowLateSubmission">Soumissions tardives</Label>
              <p className="text-sm text-muted-foreground">
                Autoriser les soumissions après la date limite
              </p>
            </div>
            <Switch
              id="allowLateSubmission"
              checked={formData.allowLateSubmission}
              onCheckedChange={(checked) => handleInputChange("allowLateSubmission", checked)}
            />
          </div>

          {formData.allowLateSubmission && (
            <div className="space-y-2">
              <Label>Pénalité par heure de retard</Label>
              <Input
                type="number"
                min="0"
                step="0.1"
                value={formData.penaltyPerHour}
                onChange={(e) => handleInputChange("penaltyPerHour", Number(e.target.value))}
              />
            </div>
          )}

          {/* --- Règles automatiques --- */}
          {/* <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium">Règles de vérification automatique</h4>
              <Button type="button" variant="outline" size="sm" onClick={addRule}>
                <Plus className="h-4 w-4 mr-1" />
                Ajouter une règle
              </Button>
            </div>

            <div className="space-y-4">
              {rules.map((rule, index) => {
                const config = getRuleConfig(rule)

                return (
                  <div key={index} className="p-3 border rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <Select 
                        value={rule.type} 
                        onValueChange={(v) => updateRule(index, 'type', v)}
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="max_size">Taille maximale</SelectItem>
                          <SelectItem value="file_presence">Fichiers requis</SelectItem>
                          <SelectItem value="folder_structure">Structure dossiers</SelectItem>
                          <SelectItem value="file_content">Contenu fichier</SelectItem>
                        </SelectContent>
                      </Select>

                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm"
                        onClick={() => deleteRule(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>

                    {rule.type === 'max_size' && (
                      <div className="space-y-2">
                        <Label>Taille maximale (Mo)</Label>
                        <Input
                          type="number"
                          min="1"
                          value={config.maxSizeMB || ""}
                          onChange={(e) => setRuleConfig(index, { maxSizeMB: Number(e.target.value) })}
                          placeholder="ex: 50"
                        />
                      </div>
                    )}

                    {rule.type === 'file_presence' && (
                      <div className="space-y-2">
                        <Label>Fichiers requis (séparés par des virgules)</Label>
                        <Input
                          value={config.requiredFiles?.join(", ") || ""}
                          onChange={(e) => setRuleConfig(index, {
                            requiredFiles: e.target.value.split(",").map(s => s.trim()).filter(Boolean)
                          })}
                          placeholder="README.md, rapport.pdf"
                        />
                      </div>
                    )}

                    {rule.type === 'folder_structure' && (
                      <div className="space-y-2">
                        <Label>Dossiers attendus (séparés par des virgules)</Label>
                        <Input
                          value={config.expectedStructure?.join(", ") || ""}
                          onChange={(e) => setRuleConfig(index, {
                            expectedStructure: e.target.value.split(",").map(s => s.trim()).filter(Boolean)
                          })}
                          placeholder="src, docs, tests"
                        />
                      </div>
                    )}

                    {rule.type === 'file_content' && (
                      <div className="space-y-2">
                        <Label>Nom du fichier</Label>
                        <Input
                          value={config.fileName || ""}
                          onChange={(e) => setRuleConfig(index, { ...config, fileName: e.target.value })}
                          placeholder="README.md"
                        />
                        <Label>Pattern regex</Label>
                        <Input
                          value={config.contentRegex || ""}
                          onChange={(e) => setRuleConfig(index, { ...config, contentRegex: e.target.value })}
                          placeholder="^# Titre"
                        />
                      </div>
                    )}
                  </div>
                )
              })}

              {rules.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Aucune règle définie. Cliquez sur "Ajouter une règle" pour commencer.
                </p>
              )}
            </div>
          </div> */}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Enregistrement..." : "Mettre à jour"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}