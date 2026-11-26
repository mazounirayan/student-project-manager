"use client"

import { useRef, useState, type FormEvent, type ReactNode } from "react"
import { AlertCircle, Loader2, Upload } from "lucide-react"
import { toast } from "sonner"
import { RuleResults } from "@/components/deliverables/RuleResults"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiPost, errorMessage } from "@/lib/api"
import {
  describeRule,
  hoursLate,
  isPastDeadline,
  latePolicy,
  type Deliverable,
  type RuleResult,
  type Submission,
} from "@/lib/deliverables"
import { formatDateFull, formatDateTime, formatFileSize, formatTime } from "@/lib/format"
import { submitDeliverable } from "@/services/DeliverableService"

interface SubmitDeliverableDialogProps {
  deliverable: Deliverable
  groupId: number
  /** Rendu déjà déposé : la boîte sert alors à le remplacer. */
  existing?: Submission | null
  trigger?: ReactNode
  onSubmitted?: () => void
}

type Check = { status: "idle" | "checking" | "done"; results: RuleResult[] }

const ARCHIVE_TYPES = ".zip,.rar,.7z,.tar,.gz,.tgz,.pdf"
const IDLE: Check = { status: "idle", results: [] }

/** Dépôt d’un livrable : rappelle les règles, les vérifie dès le choix du fichier, dit ce qu’il faut corriger, puis rend ou remplace. */
export function SubmitDeliverableDialog({ deliverable, groupId, existing, trigger, onSubmitted }: SubmitDeliverableDialogProps) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [gitUrl, setGitUrl] = useState("")
  const [check, setCheck] = useState<Check>(IDLE)
  const [sending, setSending] = useState(false)
  const lastCheck = useRef(0)

  const rules = deliverable.validationRules ?? []
  const isArchive = deliverable.type === "archive"
  const late = isPastDeadline(deliverable.deadline)
  const failed = check.results.filter((result) => !result.passed)
  const ready = isArchive ? file !== null : gitUrl.trim() !== ""

  const reset = () => {
    lastCheck.current += 1
    setFile(null)
    setGitUrl("")
    setCheck(IDLE)
  }

  const changeOpen = (next: boolean) => {
    setOpen(next)
    if (!next) reset()
  }

  /** Contrôle les règles sans rien enregistrer ; une réponse tardive d’un contrôle précédent est ignorée. */
  const runCheck = async (nextFile: File | null, nextUrl: string) => {
    const ticket = ++lastCheck.current
    if (rules.length === 0 || (!nextFile && !nextUrl)) {
      setCheck(IDLE)
      return
    }
    setCheck({ status: "checking", results: [] })
    try {
      const body = new FormData()
      body.append("groupId", String(groupId))
      if (nextFile) body.append("file", nextFile)
      else body.append("gitUrl", nextUrl)
      const response = await apiPost<{ rules: RuleResult[] }>(`/deliverables/${deliverable.id}/validate`, body)
      if (ticket === lastCheck.current) setCheck({ status: "done", results: response.rules ?? [] })
    } catch (err) {
      if (ticket !== lastCheck.current) return
      setCheck(IDLE)
      toast.error("La vérification n’a pas pu se faire.", { description: errorMessage(err, "Vous pouvez tout de même rendre le livrable.") })
    }
  }

  const send = async (event: FormEvent) => {
    event.preventDefault()
    if (!ready) return
    setSending(true)
    try {
      const sent = await submitDeliverable(deliverable.id, {
        groupId,
        file: isArchive ? file : null,
        gitUrl: isArchive ? undefined : gitUrl.trim(),
      })
      const when = `${formatDateFull(sent.submittedAt)} à ${formatTime(sent.submittedAt)}`
      toast.success(existing ? "Rendu remplacé." : "Livrable rendu.", {
        description: sent.isLate ? `Enregistré le ${when}, en retard de ${hoursLate(deliverable.deadline, sent.submittedAt)} h.` : `Enregistré le ${when}.`,
      })
      changeOpen(false)
      onSubmitted?.()
    } catch (err) {
      toast.error(existing ? "Le rendu n’a pas été remplacé." : "Le livrable n’a pas été rendu.", {
        description: errorMessage(err, "Réessayez dans un instant."),
      })
    } finally {
      setSending(false)
    }
  }

  const submitLabel = existing ? "Remplacer le rendu" : "Rendre"

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Upload aria-hidden="true" />
            {existing ? "Remplacer mon rendu" : "Rendre le livrable"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{existing ? `Remplacer le rendu de « ${deliverable.name} »` : `Rendre « ${deliverable.name} »`}</DialogTitle>
          <DialogDescription>Échéance : {formatDateTime(deliverable.deadline)}</DialogDescription>
        </DialogHeader>

        <form onSubmit={send} className="space-y-5">
          {existing && (
            <p className="text-sm text-muted-foreground">
              Votre groupe a déjà rendu ce livrable le {formatDateTime(existing.submittedAt)}. Le nouveau rendu prendra la place du précédent.
            </p>
          )}

          {rules.length > 0 && (
            <section className="space-y-2" aria-labelledby="submit-rules">
              <h3 id="submit-rules" className="text-sm font-semibold">
                Ce que doit respecter votre rendu
              </h3>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {rules.map((rule) => (
                  <li key={rule.id}>{describeRule(rule)}</li>
                ))}
              </ul>
            </section>
          )}

          {isArchive ? (
            <div className="space-y-2">
              <Label htmlFor="deliverable-file">Votre archive</Label>
              <Input
                id="deliverable-file"
                type="file"
                accept={ARCHIVE_TYPES}
                onChange={(event) => {
                  const picked = event.target.files?.[0] ?? null
                  setFile(picked)
                  void runCheck(picked, "")
                }}
              />
              <p className="text-xs text-muted-foreground">
                {file ? `${file.name} (${formatFileSize(file.size)}). ` : ""}
                Un fichier .zip est recommandé : c’est le seul format dont le contenu peut être vérifié.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="deliverable-git">Lien de votre dépôt Git</Label>
              <Input
                id="deliverable-git"
                type="url"
                placeholder="https://github.com/votre-groupe/projet"
                value={gitUrl}
                onChange={(event) => setGitUrl(event.target.value)}
                onBlur={() => void runCheck(null, gitUrl.trim())}
              />
              <p className="text-xs text-muted-foreground">Le dépôt doit être accessible à votre enseignant.</p>
            </div>
          )}

          <div aria-live="polite">
            {check.status === "checking" && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                Vérification des règles en cours…
              </p>
            )}
            {check.status === "done" && check.results.length > 0 && (
              <section className="space-y-3 rounded-lg border p-4">
                <h3 className="text-sm font-semibold">
                  {failed.length === 0
                    ? "Votre rendu respecte toutes les règles"
                    : `${failed.length} règle${failed.length > 1 ? "s" : ""} à corriger avant de rendre`}
                </h3>
                <RuleResults results={check.results} />
                {failed.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Corrigez votre archive et choisissez-la à nouveau. Vous pouvez aussi rendre tel quel : votre enseignant verra que ce rendu n’est pas conforme.
                  </p>
                )}
              </section>
            )}
          </div>

          <Alert variant={late ? "destructive" : "default"}>
            <AlertCircle aria-hidden="true" />
            <AlertDescription>
              {late && deliverable.allowLateSubmission && "L’échéance est dépassée : ce rendu sera enregistré en retard. "}
              {latePolicy(deliverable)}
            </AlertDescription>
          </Alert>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => changeOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={!ready || sending || check.status === "checking"}>
              {sending ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Upload aria-hidden="true" />}
              {sending ? "Envoi…" : failed.length > 0 ? `${submitLabel} malgré tout` : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
