"use client"

import { useMemo, useState, type ChangeEvent, type DragEvent } from "react"
import { Download, FileText, Plus, Upload, X } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { errorMessage } from "@/lib/api"
import { formatFileSize, plural } from "@/lib/format"
import { cn } from "@/lib/utils"
import {
  MAX_STUDENTS_PER_IMPORT,
  checkRows,
  countStates,
  downloadStudentTemplate,
  parseCsv,
  parseJson,
  parseStudentText,
  type CheckedRow,
  type ParsedList,
  type StudentRow,
} from "@/lib/student-import"
import { promotionService, type EnrollmentSummary, type Promotion } from "@/services/PromotionService"

interface AddStudentsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  promotion: Promotion
  /** Appelé dès que l’API a enregistré les étudiants, avec la promotion à jour. */
  onAdded: (promotion: Promotion) => void
}

export function AddStudentsDialog({ open, onOpenChange, promotion, onAdded }: AddStudentsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <AddStudentsForm promotion={promotion} onAdded={onAdded} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

const EXAMPLE_CSV = `nom;prenom;email
Dupont;Jean;jean.dupont@example.org
Martin;Claire;claire.martin@example.org`

const EXAMPLE_JSON = `[
  { "nom": "Dupont", "prenom": "Jean", "email": "jean.dupont@example.org" },
  { "nom": "Martin", "prenom": "Claire", "email": "claire.martin@example.org" }
]`

const blankRow = (): StudentRow => ({ where: "", lastName: "", firstName: "", email: "" })

type Source = "file" | "paste" | "manual"

function AddStudentsForm({ promotion, onAdded, onClose }: Pick<AddStudentsDialogProps, "promotion" | "onAdded"> & { onClose: () => void }) {
  const [source, setSource] = useState<Source>("file")
  const [file, setFile] = useState<{ name: string; size: number } | null>(null)
  const [fileList, setFileList] = useState<ParsedList | null>(null)
  const [pasted, setPasted] = useState("")
  const [manual, setManual] = useState<StudentRow[]>([blankRow()])
  const [onlyIgnored, setOnlyIgnored] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)
  const [report, setReport] = useState<{ added: number; summary: EnrollmentSummary; errors: string[] } | null>(null)

  const enrolled = useMemo(() => new Set((promotion.students ?? []).map((student) => student.email.toLowerCase())), [promotion.students])

  const parsed: ParsedList | null = useMemo(() => {
    if (source === "file") return fileList
    if (source === "paste") return pasted.trim() ? parseStudentText(pasted) : null
    return { rows: manual.map((row, index) => ({ ...row, where: `Ligne ${index + 1}` })) }
  }, [source, fileList, pasted, manual])

  const rows = useMemo(() => (parsed ? checkRows(parsed.rows, enrolled) : []), [parsed, enrolled])
  const counts = countStates(rows)
  const ignored = rows.length - counts.ready
  const tooMany = counts.ready > MAX_STUDENTS_PER_IMPORT
  const canSubmit = counts.ready > 0 && !tooMany && !pending

  const readFile = async (selected: File | undefined) => {
    if (!selected) return
    const extension = (selected.name.split(".").pop() ?? "").toLowerCase()
    if (extension !== "csv" && extension !== "json") {
      toast.error("Ce format n’est pas pris en charge.", {
        description: extension === "xlsx" || extension === "xls" ? "Dans Excel, choisissez « Enregistrer sous », puis « CSV »." : "Choisissez un fichier .csv ou .json.",
      })
      return
    }
    try {
      const text = await selected.text()
      setFile({ name: selected.name, size: selected.size })
      setFileList(extension === "json" ? parseJson(text) : parseCsv(text))
      setOnlyIgnored(false)
    } catch (err) {
      toast.error("Impossible de lire ce fichier.", { description: errorMessage(err, "Essayez de le réenregistrer.") })
    }
  }

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    readFile(event.target.files?.[0])
    event.target.value = ""
  }

  const handleDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    readFile(event.dataTransfer.files?.[0])
  }

  const updateManual = (index: number, field: "lastName" | "firstName" | "email", value: string) =>
    setManual((current) => current.map((row, i) => (i === index ? { ...row, [field]: value } : row)))

  const submit = async () => {
    setPending(true)
    setFailure(null)
    const sent = rows.filter((row) => row.state === "ready")
    try {
      const { promotion: updated, summary } = await promotionService.addStudents(
        promotion.id,
        sent.map(({ firstName, lastName, email }) => ({ firstName, lastName, email })),
      )
      onAdded(updated)
      const added = summary.newStudents + summary.existingStudents
      // Les lignes du bilan renvoyé par l’API sont numérotées dans la liste envoyée : on les relie à l’adresse.
      const errors = summary.errors.map((message) =>
        message.replace(/^Ligne (\d+) : /, (_, n: string) => (sent[Number(n) - 1] ? `${sent[Number(n) - 1].email} : ` : "")),
      )
      if (errors.length === 0) {
        toast.success(`${plural(added, "étudiant")} ${added < 2 ? "ajouté" : "ajoutés"} à « ${promotion.name} ».`)
        onClose()
      } else {
        setReport({ added, summary, errors })
      }
    } catch (err) {
      setFailure(errorMessage(err, "L’ajout a échoué. Aucun étudiant n’a été ajouté, vous pouvez réessayer."))
    } finally {
      setPending(false)
    }
  }

  if (report) return <ReportView promotion={promotion} report={report} onClose={onClose} />

  const visibleRows = onlyIgnored ? rows.filter((row) => row.state !== "ready") : rows
  const showPreview = source !== "manual" && rows.length > 0

  return (
    <>
      <DialogHeader>
        <DialogTitle>Ajouter des étudiants</DialogTitle>
        <DialogDescription>
          Promotion « {promotion.name} », {plural(promotion.students?.length ?? 0, "étudiant")} pour l’instant.
        </DialogDescription>
      </DialogHeader>

      <Tabs value={source} onValueChange={(value) => setSource(value as Source)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="file">Fichier</TabsTrigger>
          <TabsTrigger value="paste">Liste collée</TabsTrigger>
          <TabsTrigger value="manual">Saisie</TabsTrigger>
        </TabsList>

        <TabsContent value="file" className="mt-4 space-y-4">
          <label
            htmlFor="students-file"
            onDragOver={(event) => {
              event.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={cn(
              "flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/50",
              dragging ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
            )}
          >
            {file ? <FileText aria-hidden="true" className="h-8 w-8 text-primary" /> : <Upload aria-hidden="true" className="h-8 w-8 text-muted-foreground" />}
            {file ? (
              <>
                <span className="text-sm font-medium break-all">{file.name}</span>
                <span className="text-xs text-muted-foreground">{formatFileSize(file.size)} · cliquez pour choisir un autre fichier</span>
              </>
            ) : (
              <>
                <span className="text-sm font-medium text-primary">Choisir un fichier CSV ou JSON</span>
                <span className="text-xs text-muted-foreground">ou le déposer ici. Vous verrez un aperçu avant l’ajout.</span>
              </>
            )}
            <input id="students-file" type="file" accept=".csv,.json,text/csv,application/json" onChange={handleFileInput} className="sr-only" />
          </label>
          {file ? (
            <details className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
              <summary className="cursor-pointer rounded-sm font-medium focus-visible:outline-2 focus-visible:outline-primary">Rappel du format attendu</summary>
              <div className="mt-3">
                <FormatHelp />
              </div>
            </details>
          ) : (
            <div className="rounded-lg bg-muted/50 p-3">
              <FormatHelp />
            </div>
          )}
        </TabsContent>

        <TabsContent value="paste" className="mt-4 space-y-3">
          <div className="space-y-2">
            <Label htmlFor="students-paste">Collez vos lignes</Label>
            <Textarea
              id="students-paste"
              rows={6}
              value={pasted}
              onChange={(event) => setPasted(event.target.value)}
              placeholder={"Dupont\tJean\tjean.dupont@example.org\nMartin\tClaire\tclaire.martin@example.org"}
              className="font-mono text-xs"
              spellCheck={false}
            />
            <p className="text-xs text-muted-foreground">
              Copiez les colonnes nom, prénom et e-mail depuis votre tableur, ou collez le contenu d’un fichier CSV ou JSON.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="manual" className="mt-4 space-y-3">
          <ul className="space-y-3">
            {manual.map((row, index) => {
              const checked = rows.find((item) => item.where === `Ligne ${index + 1}`)
              const problem = checked && checked.state !== "ready" && (row.email || row.lastName || row.firstName) ? checked.message : undefined
              return (
                <li key={index}>
                  <div className="flex items-start gap-2">
                    <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_1fr_1.6fr]">
                      <Input aria-label={`Nom, étudiant ${index + 1}`} placeholder="Nom" autoComplete="off" value={row.lastName} onChange={(e) => updateManual(index, "lastName", e.target.value)} />
                      <Input aria-label={`Prénom, étudiant ${index + 1}`} placeholder="Prénom" autoComplete="off" value={row.firstName} onChange={(e) => updateManual(index, "firstName", e.target.value)} />
                      <Input
                        aria-label={`E-mail, étudiant ${index + 1}`}
                        aria-invalid={problem ? true : undefined}
                        type="email"
                        placeholder="prenom.nom@example.org"
                        autoComplete="off"
                        value={row.email}
                        onChange={(e) => updateManual(index, "email", e.target.value)}
                      />
                    </div>
                    {manual.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" aria-label={`Retirer la ligne ${index + 1}`} onClick={() => setManual((current) => current.filter((_, i) => i !== index))}>
                        <X aria-hidden="true" className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {problem && <p className="mt-1 text-xs text-destructive">{problem}</p>}
                </li>
              )
            })}
          </ul>
          <Button type="button" variant="outline" size="sm" onClick={() => setManual((current) => [...current, blankRow()])}>
            <Plus aria-hidden="true" className="h-4 w-4" />
            Ajouter une ligne
          </Button>
        </TabsContent>
      </Tabs>

      {parsed?.error && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-foreground">
          {parsed.error}
        </p>
      )}

      {showPreview && (
        <section aria-label="Aperçu de l’import" className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p aria-live="polite" className="text-sm">
              <span className="font-medium">{plural(rows.length, "ligne")} lue{rows.length < 2 ? "" : "s"}</span>
              <span className="text-muted-foreground">
                {" "}
                : {counts.ready} prête{counts.ready < 2 ? "" : "s"}
                {counts.enrolled > 0 && `, ${counts.enrolled} déjà inscrit${counts.enrolled < 2 ? "" : "s"}`}
                {counts.duplicate > 0 && `, ${plural(counts.duplicate, "doublon")}`}
                {counts.invalid > 0 && `, ${counts.invalid} à corriger`}.
              </span>
            </p>
            {ignored > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setOnlyIgnored((value) => !value)}>
                {onlyIgnored ? "Voir toutes les lignes" : `Voir les ${ignored} ignorées`}
              </Button>
            )}
          </div>
          <PreviewTable rows={visibleRows} />
          {ignored > 0 && <p className="text-xs text-muted-foreground">Les lignes ignorées ne sont pas ajoutées. Corrigez votre fichier et rechargez-le, ou ajoutez les lignes prêtes dès maintenant.</p>}
        </section>
      )}

      {tooMany && (
        <p role="alert" className="text-sm text-destructive">
          {MAX_STUDENTS_PER_IMPORT} étudiants au plus par ajout : coupez votre liste en deux.
        </p>
      )}
      {failure && (
        <p role="alert" className="text-sm text-destructive">
          {failure}
        </p>
      )}

      <p className="text-xs text-muted-foreground">Un étudiant qui n’a pas encore de compte en reçoit un, avec un mot de passe provisoire envoyé par e-mail.</p>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Annuler
        </Button>
        <Button onClick={submit} disabled={!canSubmit}>
          {pending ? "Ajout en cours…" : counts.ready > 0 ? `Ajouter ${plural(counts.ready, "étudiant")}` : "Ajouter"}
        </Button>
      </DialogFooter>
    </>
  )
}

function FormatHelp() {
  return (
    <div className="space-y-2 text-sm">
      <p className="font-medium">Format attendu</p>
      <p className="text-muted-foreground">
        Une ligne par étudiant, avec les colonnes <code className="font-mono text-xs">nom</code>, <code className="font-mono text-xs">prenom</code> et{" "}
        <code className="font-mono text-xs">email</code> (obligatoire). Séparateur : point-virgule ou virgule. Depuis Excel : « Enregistrer sous », puis « CSV ».
      </p>
      <pre className="overflow-x-auto rounded-md border bg-background p-3 font-mono text-xs leading-relaxed">{EXAMPLE_CSV}</pre>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer rounded-sm hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary">Même chose en JSON</summary>
          <pre className="mt-2 overflow-x-auto rounded-md border bg-background p-3 font-mono leading-relaxed text-foreground">{EXAMPLE_JSON}</pre>
        </details>
        <Button type="button" variant="outline" size="sm" onClick={downloadStudentTemplate}>
          <Download aria-hidden="true" className="h-4 w-4" />
          Télécharger un modèle CSV
        </Button>
      </div>
    </div>
  )
}

const STATE_LABEL: Record<CheckedRow["state"], { text: string; variant: "secondary" | "destructive" | "outline" }> = {
  ready: { text: "Prête", variant: "secondary" },
  invalid: { text: "À corriger", variant: "destructive" },
  duplicate: { text: "Doublon", variant: "outline" },
  enrolled: { text: "Déjà inscrit", variant: "outline" },
}

function PreviewTable({ rows }: { rows: CheckedRow[] }) {
  return (
    <div className="max-h-64 overflow-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">Ligne</th>
            <th scope="col" className="px-3 py-2 font-medium">Étudiant</th>
            <th scope="col" className="px-3 py-2 font-medium">Résultat</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => {
            const label = STATE_LABEL[row.state]
            const name = `${row.firstName} ${row.lastName}`.trim()
            return (
              <tr key={row.where} className={cn("align-top", row.state !== "ready" && "bg-muted/40")}>
                <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{row.where}</td>
                <td className="min-w-0 px-3 py-2">
                  <p className={cn("font-medium", !name && "text-muted-foreground")}>{name || "Sans nom"}</p>
                  <p className="break-all text-xs text-muted-foreground">{row.email || "Sans adresse"}</p>
                </td>
                <td className="px-3 py-2">
                  <Badge variant={label.variant}>{label.text}</Badge>
                  {row.message && <p className="mt-1 text-xs text-muted-foreground">{row.message}</p>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ReportView({ promotion, report, onClose }: { promotion: Promotion; report: { added: number; summary: EnrollmentSummary; errors: string[] }; onClose: () => void }) {
  const { added, summary, errors } = report
  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {plural(added, "étudiant")} {added < 2 ? "ajouté" : "ajoutés"}
        </DialogTitle>
        <DialogDescription>Promotion « {promotion.name} ».</DialogDescription>
      </DialogHeader>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        <li>{plural(summary.newStudents, "compte créé", "comptes créés")}</li>
        <li>{plural(summary.existingStudents, "compte existant rattaché", "comptes existants rattachés")}</li>
      </ul>
      <div className="space-y-2">
        <p className="text-sm font-medium">À vérifier ({errors.length})</p>
        <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border bg-muted/40 p-3 text-sm">
          {errors.map((message, index) => (
            <li key={index}>{message}</li>
          ))}
        </ul>
      </div>
      <DialogFooter>
        <Button onClick={onClose}>Terminer</Button>
      </DialogFooter>
    </>
  )
}
