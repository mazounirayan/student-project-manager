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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Upload, UserPlus, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/components/ui/use-toast"

type StudentInput = { nom: string; prenom: string; email: string }

interface AddStudentsDialogProps {
    promotionName: string
    promotionId: number
    onAddStudents: (promotionId: number, students: StudentInput[]) => void
    onAddStudentsFile?: (promotionId: number, file: File) => void
    onParseError?: (err: unknown) => void
    trigger?: React.ReactNode
}

export function AddStudentsDialog({
    promotionId,
    promotionName,
    onAddStudents,
    onAddStudentsFile,
    onParseError,
    trigger,
}: AddStudentsDialogProps) {
    const [open, setOpen] = useState(false)
    const [activeTab, setActiveTab] = useState<'manual' | 'file'>('manual')

    // Manual form state
    const [manualStudents, setManualStudents] = useState([{ nom: "", prenom: "", email: "" }])

    // File upload state
    const [file, setFile] = useState<File | null>(null)
    const [filePreview, setFilePreview] = useState<StudentInput[]>([])

    const addManualStudent = () => setManualStudents([...manualStudents, { nom: "", prenom: "", email: "" }])

    const removeManualStudent = (index: number) => setManualStudents(manualStudents.filter((_, i) => i !== index))

    const updateManualStudent = (index: number, field: keyof StudentInput, value: string) =>
        setManualStudents((s) => {
            const next = [...s]
            next[index] = { ...next[index], [field]: value }
            return next
        })

    const parseJsonStudents = (content: string): StudentInput[] => {
        const json = JSON.parse(content)
        const arr: any[] = Array.isArray(json) ? json : Array.isArray(json?.students) ? json.students : [json]
        return arr
            ?.map((r) => {
                // accepte {nom,email} ou {name,email} (FR/EN)
                const nom = r.nom ?? r.name ?? ''
                const prenom = r.prenom ?? r.firstName ?? ''
                const email = r.email ?? r.mail ?? ''
                return { nom: String(nom).trim(), prenom: String(prenom).trim(), email: String(email).trim() }
            })
            .filter((s) => s.nom && s.email)
    }

    const parseCsvStudents = (content: string, filename: string): StudentInput[] => {
        // détection simple du séparateur
        const sep = content.includes('\n') && content.split('\n')[0].includes(';') ? ';' : ','
        const rows = content.split(/\r?\n/).filter((l) => l.trim().length)
        if (rows.length === 0) return []

        const headers = rows[0].split(sep)?.map((h) => h.trim().toLowerCase())
        const getIdx = (candidates: string[]) =>
            headers.findIndex((h) => candidates.some((c) => h === c || h.includes(c)))

        const nomIdx = getIdx(['nom', 'name'])
        const prenomIdx = getIdx(['prenom', 'firstName'])
        const emailIdx = getIdx(['email', 'mail'])

        const out: StudentInput[] = []
        for (let i = 1; i < rows.length; i++) {
            const cols = rows[i].split(sep)?.map((v) => v.trim().replace(/^"|"$/g, ''))
            const nom = nomIdx >= 0 ? cols[nomIdx] : ''
            const prenom = prenomIdx >= 0 ? cols[prenomIdx] : ''
            const email = emailIdx >= 0 ? cols[emailIdx] : ''
            if (nom && email) out.push({ nom, prenom, email })
        }
        return out
    }

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const ext = (file.name.split('.').pop() ?? '').toLowerCase();
        if (!["csv", "json"].includes(ext)) {
            toast({ title: "Format invalide", description: "Le fichier doit être au format CSV ou JSON.", variant: "destructive" });
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
            let parsedData: any[] = [];

            if (ext === "json") {
                parsedData = JSON.parse(event.target?.result as string);
            } else if (ext === "csv") {
                const text = event.target?.result as string;
                const [headerLine, ...lines] = text.trim().split("\n");
                const headers = headerLine.split(",").map(h => h.trim().toLowerCase());
                const expectedHeaders = ["nom", "prenom", "email"];

                const missingHeaders = expectedHeaders.filter(h => !headers.includes(h));
                if (missingHeaders.length > 0) {
                toast({
                    title: "Erreur de format CSV",
                    description: `Colonnes manquantes: ${missingHeaders.join(", ")}`,
                    variant: "destructive"
                });
                return;
                }

                parsedData = lines.map(line => {
                const values = line.split(",");
                return Object.fromEntries(headers.map((h, i) => [h, values[i]?.trim()]));
                });
            }

            const validData = parsedData.filter(
                (s) => s.nom && s.email && s.prenom
            );

            if (validData.length === 0) {
                toast({
                title: "Aucune donnée valide détectée",
                description: "Assurez-vous que les champs nom, prénom et email sont présents.",
                variant: "destructive"
                });
                return;
            }

            setFile(file);
            setFilePreview(validData);
            toast({
                title: "Fichier importé",
                description: `${validData.length} étudiant(s) détecté(s).`,
            });
            } catch (err) {
            toast({
                title: "Erreur de lecture du fichier",
                description: "Le format du fichier semble invalide.",
                variant: "destructive"
            });
            }
        };

        reader.readAsText(file);
        };


    const resetForm = () => {
        setManualStudents([{ nom: '', prenom: '', email: '' }])
        setFile(null)
        setFilePreview([])
    }

    // Dans AddStudentsDialog - CORRECTION de handleSubmit
// Dans AddStudentsDialog - modification de handleSubmit
const handleSubmit = () => {
  const studentsToAdd =
    activeTab === 'manual'
      ? manualStudents.filter((s) => s.nom && s.email && s.prenom)
      : filePreview;

  if (studentsToAdd.length === 0) {
    toast({
      title: "Aucun étudiant valide",
      description: "Veuillez saisir des étudiants valides",
      variant: "destructive"
    });
    return;
  }

  // CORRECTION : Différencier import fichier CSV/Excel vs JSON/Manuel
  if (activeTab === 'file' && file) {
    const ext = file.name.split('.').pop()?.toLowerCase();
    
    if (ext === 'csv' || ext === 'xlsx' || ext === 'xls') {
      // Pour CSV/Excel : utiliser l'endpoint d'import
      onAddStudentsFile?.(promotionId, file);
    } else if (ext === 'json') {
      // Pour JSON : utiliser l'endpoint standard avec les données parsées
      onAddStudents(promotionId, studentsToAdd);
    }
  } else {
    // Pour l'ajout manuel
    onAddStudents(promotionId, studentsToAdd);
  }

  setOpen(false);
  resetForm();
};
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Ajouter des étudiants
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Ajouter des étudiants</DialogTitle>
                    <DialogDescription>Ajoutez des étudiants à la promotion "{promotionName}"</DialogDescription>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="manual">Manuel</TabsTrigger>
                        <TabsTrigger value="file">Fichier</TabsTrigger>
                    </TabsList>

                    <TabsContent value="manual" className="space-y-4">
                        <div className="space-y-3">
                            {manualStudents?.map((student, index) => (
                                <div key={index} className="flex gap-2 items-end">
                                    <div className="flex-1">
                                        {/* <Label htmlFor={`name-${index}`}>Nom</Label> */}
                                        <Input
                                            id={`name-${index}`}
                                            placeholder="Nom"
                                            value={student.nom}
                                            onChange={(e) => updateManualStudent(index, "nom", e.target.value)}
                                        />
                                    </div>
                                    <div className="flex-1">
                                        {/* <Label htmlFor={`prenom-${index}`}>Prénom</Label> */}
                                        <Input
                                            id={`prenom-${index}`}
                                            placeholder="Prénom "
                                            value={student.prenom}
                                            onChange={(e) => updateManualStudent(index, "prenom", e.target.value)}
                                        />
                                    </div>
                                    <div className="flex-1">
                                        {/* <Label htmlFor={`email-${index}`}>Email</Label> */}
                                        <Input
                                            id={`email-${index}`}
                                            type="email"
                                            placeholder="email@student.fr"
                                            value={student.email}
                                            onChange={(e) => updateManualStudent(index, "email", e.target.value)}
                                        />
                                    </div>
                                    {manualStudents.length > 1 && (
                                        <Button type="button" variant="outline" size="icon" onClick={() => removeManualStudent(index)}>
                                            <X className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                        <Button type="button" variant="outline" onClick={addManualStudent}>
                            <UserPlus className="mr-2 h-4 w-4" />
                            Ajouter un étudiant
                        </Button>
                    </TabsContent>

                    <TabsContent value="file" className="space-y-4">
                        <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6">
                            <div className="text-center">
                                <Upload className="mx-auto h-12 w-12 text-muted-foreground" />
                                <div className="mt-4">
                                    <Label htmlFor="file-upload" className="cursor-pointer">
                                        <span className="text-sm font-medium text-primary hover:text-primary/80">
                                            Cliquez pour télécharger
                                        </span>
                                        <span className="text-sm text-muted-foreground"> ou glissez-déposez</span>
                                    </Label>
                                    <Input
                                        id="file-upload"
                                        type="file"
                                        accept=".csv,.json"
                                        onChange={handleFileUpload}
                                        className="hidden"
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">Formats supportés: CSV, JSON</p>
                            </div>
                        </div>
                        <div className="mt-4">
                        <Tabs defaultValue="csv" className="w-full">
                            <TabsList className="grid grid-cols-2 w-full">
                            <TabsTrigger value="csv">Exemple CSV</TabsTrigger>
                            <TabsTrigger value="json">Exemple JSON</TabsTrigger>
                            </TabsList>
                            <TabsContent value="csv">
                            <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto">
                                nom,prenom,email<br/>
                                Dupont,Jean,jean.dupont@example.com<br/>
                                Martin,Claire,claire.martin@example.com
                            </pre>
                          
                            </TabsContent>
                            <TabsContent value="json">
                            <pre className="bg-muted p-3 rounded-md text-xs overflow-x-auto">
                            {`[
    { "nom": "Dupont", "prenom": "Jean", "email": "jean.dupont@example.com" },
    { "nom": "Martin", "prenom": "Claire", "email": "claire.martin@example.com" }
]`}
                            </pre>
                       
                            </TabsContent>
                        </Tabs>
                        </div>

                        {file && (
                            <div className="p-3 bg-muted rounded-lg">
                                <p className="text-sm font-medium">Fichier sélectionné: {file.name}</p>
                                <p className="text-xs text-muted-foreground">{filePreview.length} étudiant(s) détecté(s)</p>
                            </div>
                        )}
                    </TabsContent>
                </Tabs>

                {filePreview.length > 0 && (
                    <div className="mt-4">
                        <Label>Aperçu ({filePreview.length} étudiants)</Label>
                        <div className="max-h-32 overflow-y-auto border rounded-md p-2 space-y-1">
                            {filePreview?.map((student, index) => (
                                <div key={index} className="flex gap-2">
                                    <Badge variant="outline">{student.nom}</Badge>
                                    <Badge variant="secondary">{student.email}</Badge>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Annuler
                    </Button>
                    <Button onClick={handleSubmit}>
                        Ajouter{" "}
                        {activeTab === "manual" ? manualStudents.filter((s) => s.nom && s.email).length : filePreview.length}{" "}
                        étudiant(s)
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
