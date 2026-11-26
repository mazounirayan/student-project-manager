'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ListPlus, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { SectionCard } from '@/components/shared/SectionCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { apiPut, errorMessage } from '@/lib/api'
import { confirmAction } from '@/lib/dialogs'
import { formatTime, plural, toDatetimeLocal } from '@/lib/format'
import { contentOf, isDeadlinePassed, isWritten, sortedSections, type GroupReport, type ReportConfig } from '@/lib/reports'
import { ReportSectionConfigItem, type SectionDraft, type SectionErrors } from './ReportSectionConfigItem'
import { useUnsavedWarning } from './use-unsaved-warning'

interface FormState {
  isEnabled: boolean
  instructions: string
  /** Valeur d’un champ `datetime-local` (heure locale). */
  deadline: string
  sections: SectionDraft[]
}

const STARTER_SECTIONS: Array<Pick<SectionDraft, 'title' | 'description' | 'required' | 'wordLimit'>> = [
  { title: 'Introduction et contexte', description: 'Présentez le besoin, les utilisateurs visés et le périmètre du projet.', required: true, wordLimit: '400' },
  { title: 'Réalisation', description: 'Décrivez les choix techniques et la façon dont vous avez travaillé.', required: true, wordLimit: '600' },
  { title: 'Bilan et perspectives', description: 'Ce que vous avez appris, les difficultés rencontrées et les suites possibles.', required: false, wordLimit: '300' },
]

let nextUid = 0
const newUid = () => `s${++nextUid}`

function toForm(config: ReportConfig): FormState {
  return {
    // Une première configuration s’ouvre déjà activée : l’enseignante vient justement demander un rapport.
    isEnabled: config.id ? config.isEnabled : true,
    instructions: config.instructions ?? '',
    deadline: toDatetimeLocal(config.deadline),
    sections: sortedSections(config).map((section) => ({
      uid: newUid(),
      id: section.id,
      title: section.title,
      description: section.description ?? '',
      required: section.required,
      wordLimit: section.wordLimit ? String(section.wordLimit) : '',
    })),
  }
}

const snapshot = (form: FormState) => JSON.stringify({ ...form, sections: form.sections.map(({ uid, ...rest }) => rest) })

function validate(form: FormState): { sections: Record<string, SectionErrors>; summary: string | null } {
  const sections: Record<string, SectionErrors> = {}
  for (const section of form.sections) {
    const errors: SectionErrors = {}
    if (!section.title.trim()) errors.title = 'Donnez un titre à cette section.'
    if (section.wordLimit.trim() && !/^[1-9]\d*$/.test(section.wordLimit.trim())) errors.wordLimit = 'Indiquez un nombre entier de mots, ou laissez vide.'
    if (errors.title || errors.wordLimit) sections[section.uid] = errors
  }
  if (form.isEnabled && form.sections.length === 0) return { sections, summary: 'Ajoutez au moins une section : les groupes ne peuvent rien rédiger sans.' }
  return { sections, summary: Object.keys(sections).length > 0 ? 'Corrigez les champs signalés avant d’enregistrer.' : null }
}

interface TeacherReportConfigProps {
  projectId: number
  config: ReportConfig
  /** Rapports déjà commencés : servent à prévenir quand on retire une section qui contient du texte. */
  reports: GroupReport[]
  onSaved: (config: ReportConfig) => void
  onDirtyChange?: (dirty: boolean) => void
}

/** Définition du rapport attendu : consignes, échéance et sections, dans l’ordre où les groupes les rédigent. */
export function TeacherReportConfig({ projectId, config, reports, onSaved, onDirtyChange }: TeacherReportConfigProps) {
  const isNew = !config.id
  const [form, setForm] = useState<FormState>(() => toForm(config))
  const [baseline, setBaseline] = useState(() => snapshot(form))
  const [errors, setErrors] = useState<Record<string, SectionErrors>>({})
  const [summary, setSummary] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const newestSection = useRef<string | null>(null)

  const dirty = useMemo(() => snapshot(form) !== baseline, [form, baseline])
  useUnsavedWarning(dirty)
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange])

  // Une section ajoutée reçoit le focus pour qu’on puisse taper son titre tout de suite.
  useEffect(() => {
    if (!newestSection.current) return
    document.getElementById(`section-${newestSection.current}-title`)?.focus()
    newestSection.current = null
  }, [form.sections.length])

  const update = (updates: Partial<FormState>) => setForm((current) => ({ ...current, ...updates }))
  const updateSection = (uid: string, updates: Partial<SectionDraft>) =>
    setForm((current) => ({ ...current, sections: current.sections.map((section) => (section.uid === uid ? { ...section, ...updates } : section)) }))

  const addSections = (drafts: Array<Partial<SectionDraft>>) => {
    const added = drafts.map<SectionDraft>((draft) => ({ uid: newUid(), title: '', description: '', required: true, wordLimit: '', ...draft }))
    newestSection.current = added[0].uid
    setForm((current) => ({ ...current, sections: [...current.sections, ...added] }))
    setSummary(null)
  }

  const moveSection = (index: number, delta: -1 | 1) =>
    setForm((current) => {
      const sections = [...current.sections]
      const [moved] = sections.splice(index, 1)
      sections.splice(index + delta, 0, moved)
      return { ...current, sections }
    })

  const removeSection = async (section: SectionDraft) => {
    const written = section.id ? reports.filter((report) => isWritten(contentOf(report, section.id as number)?.content)).length : 0
    if (written > 0) {
      const confirmed = await confirmAction({
        title: 'Retirer cette section ?',
        description: `${plural(written, 'groupe a', 'groupes ont')} déjà écrit dans « ${section.title.trim() || 'cette section'} ». Ce texte sera supprimé quand vous enregistrerez.`,
        confirmText: 'Retirer la section',
        destructive: true,
      })
      if (!confirmed) return
    }
    setForm((current) => ({ ...current, sections: current.sections.filter((item) => item.uid !== section.uid) }))
  }

  const save = async (event: FormEvent) => {
    event.preventDefault()
    const result = validate(form)
    setErrors(result.sections)
    setSummary(result.summary)
    if (result.summary) {
      // Le focus va au premier champ à corriger, pour que le message qui l’accompagne soit lu.
      const first = form.sections.find((section) => result.sections[section.uid])
      if (first) document.getElementById(`section-${first.uid}-${result.sections[first.uid].title ? 'title' : 'wordlimit'}`)?.focus()
      return
    }
    const deadline = form.deadline ? new Date(form.deadline).toISOString() : null
    if (form.isEnabled && isDeadlinePassed(deadline)) {
      const confirmed = await confirmAction({
        title: 'La date limite est déjà passée',
        description: 'Les groupes ne pourront ni modifier ni rendre leur rapport. Vous pourrez la repousser plus tard.',
        confirmText: 'Enregistrer quand même',
      })
      if (!confirmed) return
    }

    setSaving(true)
    try {
      const saved = await apiPut<ReportConfig>(`/reports/projects/${projectId}/report-config`, {
        isEnabled: form.isEnabled,
        format: config.format,
        deadline,
        instructions: form.instructions.trim() || null,
        sections: form.sections.map((section) => ({
          id: section.id,
          title: section.title.trim(),
          description: section.description.trim(),
          required: section.required,
          wordLimit: section.wordLimit.trim() ? Number(section.wordLimit) : null,
        })),
      })
      const next = toForm(saved)
      setForm(next)
      setBaseline(snapshot(next))
      setSavedAt(new Date())
      toast.success(form.isEnabled ? 'Consignes enregistrées' : 'Consignes enregistrées, le rapport n’est pas demandé aux groupes')
      onSaved(saved)
    } catch (error) {
      toast.error(errorMessage(error, 'Impossible d’enregistrer les consignes du rapport.'))
    } finally {
      setSaving(false)
    }
  }

  const reset = () => {
    const original = toForm(config)
    setForm(original)
    setBaseline(snapshot(original))
    setErrors({})
    setSummary(null)
  }

  return (
    <form onSubmit={save} noValidate className="max-w-3xl space-y-6">
      <SectionCard title="Rapport du projet" description="Ce que les groupes voient en ouvrant l’onglet Rapport de leur espace.">
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-4 rounded-lg border bg-muted/40 p-4">
            <div className="space-y-1">
              <Label htmlFor="report-enabled" className="text-base">
                Demander un rapport aux groupes
              </Label>
              <p className="text-sm text-muted-foreground">
                {form.isEnabled
                  ? 'Les groupes peuvent rédiger leur rapport en ligne, puis le rendre.'
                  : 'Les groupes ne voient aucun rapport. Les textes déjà rédigés sont conservés.'}
              </p>
            </div>
            <Switch id="report-enabled" checked={form.isEnabled} onCheckedChange={(isEnabled) => update({ isEnabled })} className="data-[state=unchecked]:bg-muted-foreground/40" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-instructions">Consignes générales</Label>
            <Textarea
              id="report-instructions"
              value={form.instructions}
              onChange={(event) => update({ instructions: event.target.value })}
              placeholder="Ton attendu, public visé, ce que vous évaluerez en priorité…"
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="report-deadline">Date limite</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input id="report-deadline" type="datetime-local" value={form.deadline} onChange={(event) => update({ deadline: event.target.value })} className="w-full sm:w-64" />
              {form.deadline && (
                <Button type="button" variant="ghost" size="sm" onClick={() => update({ deadline: '' })}>
                  Retirer la date
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Après cette date, le rapport passe en lecture seule : les groupes ne peuvent plus le modifier ni le rendre. Sans date, ils le rendent quand ils veulent.
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Sections du rapport" description="Les groupes rédigent chaque section dans cet ordre, avec vos consignes à côté de l’éditeur.">
        {form.sections.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed p-5">
            <p className="text-sm text-muted-foreground">Aucune section pour l’instant. Sans section, les groupes n’ont rien à rédiger.</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => addSections(STARTER_SECTIONS)}>
                <ListPlus aria-hidden="true" />
                Partir d’une structure type
              </Button>
              <Button type="button" variant="outline" onClick={() => addSections([{}])}>
                <Plus aria-hidden="true" />
                Ajouter une section
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">La structure type propose trois sections : introduction, réalisation, bilan. Vous pouvez tout modifier ensuite.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <ol className="space-y-4">
              {form.sections.map((section, index) => (
                <ReportSectionConfigItem
                  key={section.uid}
                  section={section}
                  position={index + 1}
                  count={form.sections.length}
                  errors={errors[section.uid]}
                  onUpdate={(updates) => updateSection(section.uid, updates)}
                  onRemove={() => removeSection(section)}
                  onMove={(delta) => moveSection(index, delta)}
                />
              ))}
            </ol>
            <Button type="button" variant="outline" onClick={() => addSections([{}])}>
              <Plus aria-hidden="true" />
              Ajouter une section
            </Button>
          </div>
        )}
      </SectionCard>

      <div className="sticky bottom-0 z-10 -mx-4 border-t bg-background px-4 py-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex max-w-3xl flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p role="status" className={summary ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>
            {summary ?? (dirty ? 'Modifications non enregistrées' : savedAt ? `Enregistré à ${formatTime(savedAt)}` : isNew ? 'Pas encore enregistré' : 'Aucune modification')}
          </p>
          <div className="flex flex-wrap gap-2">
            {dirty && !isNew && (
              <Button type="button" variant="outline" onClick={reset} disabled={saving}>
                Annuler les modifications
              </Button>
            )}
            <Button type="submit" disabled={saving || (!dirty && !isNew)}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </div>
    </form>
  )
}
