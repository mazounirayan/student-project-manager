"use client"

import { useState, type FormEvent } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { describeRule, escapeRegex, splitList, type RuleType } from "@/lib/deliverables"

export interface NewRule {
  type: RuleType
  configuration: Record<string, unknown>
  /** Message affiché à l’étudiant quand la règle n’est pas respectée ; absent : le message automatique est utilisé. */
  errorMessage: string | null
}

interface DeliverableConstraintDialogProps {
  onAdd: (rule: NewRule) => Promise<void>
}

const KINDS: Array<{ value: RuleType; label: string; hint: string }> = [
  { value: "file_presence", label: "Un fichier doit être présent", hint: "Par exemple un README ou un rapport au format PDF." },
  { value: "max_size", label: "L’archive ne doit pas être trop lourde", hint: "Au-delà de cette taille, le rendu est signalé comme non conforme." },
  { value: "folder_structure", label: "Des dossiers doivent être présents", hint: "Par exemple src ou docs, où qu’ils soient dans l’archive." },
  { value: "file_content", label: "Un fichier doit contenir un texte précis", hint: "Par exemple un titre ou un mot-clé attendu dans le README." },
]

const EMPTY = { kind: "file_presence" as RuleType, files: "", folders: "", size: "", unit: "mo", contentFile: "", contentText: "", message: "" }

/** Construit la règle à partir du formulaire, ou renvoie ce qui manque. */
function buildRule(form: typeof EMPTY): { rule: NewRule } | { error: string } {
  const errorMessage = form.message.trim() || null
  switch (form.kind) {
    case "file_presence": {
      const requiredFiles = splitList(form.files)
      return requiredFiles.length > 0 ? { rule: { type: "file_presence", configuration: { requiredFiles }, errorMessage } } : { error: "Indiquez au moins un nom de fichier." }
    }
    case "folder_structure": {
      const expectedStructure = splitList(form.folders)
      return expectedStructure.length > 0
        ? { rule: { type: "folder_structure", configuration: { expectedStructure }, errorMessage } }
        : { error: "Indiquez au moins un nom de dossier." }
    }
    case "max_size": {
      const size = Number(form.size.replace(",", "."))
      if (!Number.isFinite(size) || size <= 0) return { error: "Indiquez une taille supérieure à zéro." }
      return { rule: { type: "max_size", configuration: { maxSizeMB: form.unit === "go" ? size * 1024 : size }, errorMessage } }
    }
    case "file_content": {
      const fileName = form.contentFile.trim()
      const text = form.contentText.trim()
      if (!fileName || !text) return { error: "Indiquez le fichier et le texte qu’il doit contenir." }
      return { rule: { type: "file_content", configuration: { fileName, contentRegex: escapeRegex(text) }, errorMessage } }
    }
  }
}

/** Ajout d’une règle de conformité : on dit ce qu’on attend dans le rendu, sans configuration technique. */
export function DeliverableConstraintDialog({ onAdd }: DeliverableConstraintDialogProps) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const update = (patch: Partial<typeof EMPTY>) => {
    setForm((current) => ({ ...current, ...patch }))
    setError(null)
  }

  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (next) {
      setForm(EMPTY)
      setError(null)
    }
  }

  const built = buildRule(form)
  const kind = KINDS.find((item) => item.value === form.kind)!

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if ("error" in built) {
      setError(built.error)
      return
    }
    setSaving(true)
    try {
      await onAdd(built.rule)
      setOpen(false)
    } catch {
      // l’appelant affiche l’erreur ; la boîte reste ouverte pour réessayer
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus aria-hidden="true" />
          Ajouter une règle
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajouter une règle de conformité</DialogTitle>
          <DialogDescription>
            Chaque rendu est vérifié avec cette règle dès son dépôt. L’étudiant la voit avant de rendre et sait quoi corriger.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="rule-kind">Que faut-il vérifier ?</Label>
            <Select value={form.kind} onValueChange={(value) => update({ kind: value as RuleType })}>
              <SelectTrigger id="rule-kind" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KINDS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{kind.hint}</p>
          </div>

          {form.kind === "file_presence" && (
            <div className="space-y-2">
              <Label htmlFor="rule-files">Fichiers requis</Label>
              <Textarea id="rule-files" rows={3} value={form.files} onChange={(e) => update({ files: e.target.value })} placeholder={"README.md\nrapport.pdf"} />
              <p className="text-xs text-muted-foreground">Un nom de fichier par ligne.</p>
            </div>
          )}

          {form.kind === "folder_structure" && (
            <div className="space-y-2">
              <Label htmlFor="rule-folders">Dossiers attendus</Label>
              <Textarea id="rule-folders" rows={3} value={form.folders} onChange={(e) => update({ folders: e.target.value })} placeholder={"src\ndocs"} />
              <p className="text-xs text-muted-foreground">Un nom de dossier par ligne.</p>
            </div>
          )}

          {form.kind === "max_size" && (
            <div className="space-y-2">
              <Label htmlFor="rule-size">Taille maximale</Label>
              <div className="flex gap-2">
                <Input id="rule-size" inputMode="decimal" className="flex-1" value={form.size} onChange={(e) => update({ size: e.target.value })} placeholder="50" />
                <Select value={form.unit} onValueChange={(unit) => update({ unit })}>
                  <SelectTrigger aria-label="Unité" className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mo">Mo</SelectItem>
                    <SelectItem value="go">Go</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {form.kind === "file_content" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="rule-content-file">Fichier</Label>
                <Input id="rule-content-file" value={form.contentFile} onChange={(e) => update({ contentFile: e.target.value })} placeholder="README.md" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rule-content-text">Doit contenir</Label>
                <Input id="rule-content-text" value={form.contentText} onChange={(e) => update({ contentText: e.target.value })} placeholder="Installation" />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="rule-message">Message pour l’étudiant (facultatif)</Label>
            <Textarea
              id="rule-message"
              rows={2}
              value={form.message}
              onChange={(e) => update({ message: e.target.value })}
              placeholder="Sans message, l’étudiant voit ce qui manque, par exemple « Fichiers manquants : README.md »."
            />
          </div>

          {"rule" in built && (
            <p className="rounded-md bg-muted/60 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Règle : </span>
              {describeRule({ type: built.rule.type, configuration: JSON.stringify(built.rule.configuration) })}
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Ajout…" : "Ajouter la règle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
