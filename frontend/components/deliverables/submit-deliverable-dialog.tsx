"use client"

import { useState, type ReactNode, type FormEvent } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Upload, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { submitDeliverable } from "@/services/DeliverableService"

interface SubmitDeliverableDialogProps {
  deliverableId: number
  groupId: number
  trigger?: ReactNode
  onSubmitted?: () => void
}

export function SubmitDeliverableDialog({ deliverableId, groupId, trigger, onSubmitted }: SubmitDeliverableDialogProps) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [gitUrl, setGitUrl] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()

    if (!file && gitUrl.trim() === "") {
      toast.error("Choisissez un fichier ou renseignez un lien Git.")
      return
    }

    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null
    if (!token) return

    setLoading(true)
    try {
      await submitDeliverable(deliverableId, {
        groupId,
        file,
        gitUrl: gitUrl.trim() || undefined,
      })
      toast.success("Livrable soumis avec succès.")
      setFile(null)
      setGitUrl("")
      setOpen(false)
      onSubmitted?.()
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la soumission du livrable.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Upload className="mr-2 h-4 w-4" />
            Soumettre
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Soumettre le livrable</DialogTitle>
          <DialogDescription>Téléversez un fichier ou indiquez un lien vers votre dépôt Git.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="deliverable-file">Fichier</Label>
            <Input
              id="deliverable-file"
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="text-center text-sm text-muted-foreground">OU</div>
          <div className="space-y-2">
            <Label htmlFor="deliverable-git">Lien du dépôt Git</Label>
            <Input
              id="deliverable-git"
              type="url"
              placeholder="https://github.com/utilisateur/repository"
              value={gitUrl}
              onChange={(e) => setGitUrl(e.target.value)}
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Soumettre
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
