"use client"

import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { toDatetimeLocal } from "@/lib/format"
import { plural } from "@/lib/format"
import type { CreateProjectPayload, Project } from "@/services/project.service"
import type { Promotion } from "@/services/PromotionService"

/** Valeurs du formulaire de projet, telles qu’elles sont saisies (les nombres restent du texte jusqu’à l’envoi). */
export interface ProjectFormValues {
  name: string
  description: string
  promotionId: string
  visible: boolean
  rule: "free" | "manual"
  minGroupSize: string
  maxGroupSize: string
  /** Valeur d’un champ datetime-local, vide si aucune date limite. */
  deadline: string
}

export const emptyProjectForm = (): ProjectFormValues => ({
  name: "",
  description: "",
  promotionId: "",
  visible: false,
  rule: "manual",
  minGroupSize: "2",
  maxGroupSize: "4",
  deadline: "",
})

/** Le tirage au sort se fait depuis l’onglet Groupes : il revient, pour le formulaire, à une formation par l’enseignant. */
export const formFromProject = (project: Project): ProjectFormValues => ({
  name: project.name,
  description: project.description ?? "",
  promotionId: project.promotionId ? String(project.promotionId) : "",
  visible: project.status === "visible",
  rule: project.groupFormationRule === "free" ? "free" : "manual",
  minGroupSize: project.minGroupSize ? String(project.minGroupSize) : "",
  maxGroupSize: project.maxGroupSize ? String(project.maxGroupSize) : "",
  deadline: toDatetimeLocal(project.groupFormationDeadline),
})

export const payloadFromForm = (values: ProjectFormValues): CreateProjectPayload => ({
  name: values.name.trim(),
  description: values.description.trim(),
  promotionId: Number(values.promotionId),
  status: values.visible ? "visible" : "draft",
  groupFormationRule: values.rule,
  minGroupSize: values.minGroupSize ? Number(values.minGroupSize) : undefined,
  maxGroupSize: values.maxGroupSize ? Number(values.maxGroupSize) : undefined,
  groupFormationDeadline: values.deadline ? new Date(values.deadline).toISOString() : null,
})

/** Message à afficher sous le formulaire tant que les valeurs ne peuvent pas être enregistrées, sinon null. */
export function projectFormProblem(values: ProjectFormValues): string | null {
  if (!values.name.trim()) return "Donnez un nom au projet."
  if (!values.description.trim()) return "Ajoutez une description : les étudiants y retrouvent les consignes."
  if (!values.promotionId) return "Choisissez la promotion concernée."
  const min = Number(values.minGroupSize)
  const max = Number(values.maxGroupSize)
  if (values.minGroupSize && (!Number.isInteger(min) || min < 1)) return "La taille minimale d’un groupe doit être d’au moins 1."
  if (values.maxGroupSize && (!Number.isInteger(max) || max < 1)) return "La taille maximale d’un groupe doit être d’au moins 1."
  if (min && max && min > max) return "La taille minimale ne peut pas dépasser la taille maximale."
  return null
}

interface ProjectFormFieldsProps {
  values: ProjectFormValues
  onChange: (values: ProjectFormValues) => void
  promotions: Promotion[]
  /** Fige la promotion (projet déjà doté de groupes) ; la raison s’affiche sous le champ. */
  promotionLocked?: boolean
  /** Préfixe des identifiants de champs, pour éviter les doublons si deux formulaires coexistent. */
  idPrefix: string
}

export function ProjectFormFields({ values, onChange, promotions, promotionLocked = false, idPrefix }: ProjectFormFieldsProps) {
  const set = <K extends keyof ProjectFormValues>(key: K, value: ProjectFormValues[K]) => onChange({ ...values, [key]: value })
  const promotion = promotions.find((item) => String(item.id) === values.promotionId)

  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-name`}>Nom du projet</Label>
        <Input id={`${idPrefix}-name`} placeholder="Application de gestion de bibliothèque" value={values.name} onChange={(e) => set("name", e.target.value)} required autoFocus />
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-description`}>Description et consignes</Label>
        <Textarea
          id={`${idPrefix}-description`}
          rows={5}
          placeholder="Objectifs, contexte, travail attendu, contraintes…"
          value={values.description}
          onChange={(e) => set("description", e.target.value)}
          required
        />
        <p className="text-xs text-muted-foreground">Les étudiants lisent ce texte sur la page du projet.</p>
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-promotion`}>Promotion</Label>
        {promotions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune promotion pour l’instant.{" "}
            <Link href="/promotions" className="font-medium text-primary hover:underline">
              Créez-en une
            </Link>{" "}
            avant de lancer un projet.
          </p>
        ) : (
          <>
            <Select value={values.promotionId} onValueChange={(value) => set("promotionId", value)} disabled={promotionLocked}>
              <SelectTrigger id={`${idPrefix}-promotion`} className="w-full">
                <SelectValue placeholder="Choisir une promotion" />
              </SelectTrigger>
              <SelectContent>
                {promotions.map((item) => (
                  <SelectItem key={item.id} value={String(item.id)}>
                    {item.name} ({item.year})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {promotionLocked
                ? "La promotion ne peut plus changer : des groupes sont déjà constitués."
                : promotion
                  ? `${plural(promotion.students?.length ?? 0, "étudiant")} dans cette promotion.`
                  : "Les étudiants de cette promotion verront le projet quand il sera visible."}
            </p>
          </>
        )}
      </div>

      <fieldset className="grid gap-3">
        <legend className="mb-1 text-sm font-medium">Formation des groupes</legend>
        <RadioGroup value={values.rule} onValueChange={(value) => set("rule", value as ProjectFormValues["rule"])}>
          {(
            [
              ["manual", "Par l’enseignant", "Vous répartissez les étudiants à la main ou automatiquement, depuis l’onglet Groupes."],
              ["free", "Libre", "Les étudiants rejoignent ou créent leur groupe jusqu’à la date limite."],
            ] as const
          ).map(([value, label, hint]) => (
            <label key={value} htmlFor={`${idPrefix}-rule-${value}`} className="flex cursor-pointer items-start gap-3 rounded-md border p-3 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5">
              <RadioGroupItem id={`${idPrefix}-rule-${value}`} value={value} className="mt-0.5" />
              <span className="grid gap-0.5">
                <span className="text-sm font-medium">{label}</span>
                <span className="text-xs text-muted-foreground">{hint}</span>
              </span>
            </label>
          ))}
        </RadioGroup>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}-min`}>Taille minimale</Label>
            <Input id={`${idPrefix}-min`} type="number" inputMode="numeric" min={1} max={20} value={values.minGroupSize} onChange={(e) => set("minGroupSize", e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}-max`}>Taille maximale</Label>
            <Input id={`${idPrefix}-max`} type="number" inputMode="numeric" min={1} max={20} value={values.maxGroupSize} onChange={(e) => set("maxGroupSize", e.target.value)} />
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor={`${idPrefix}-deadline`}>
            Date limite pour les groupes <span className="font-normal text-muted-foreground">(facultatif)</span>
          </Label>
          <Input id={`${idPrefix}-deadline`} type="datetime-local" value={values.deadline} onChange={(e) => set("deadline", e.target.value)} className="sm:w-60" />
          <p className="text-xs text-muted-foreground">
            {values.rule === "free" ? "Passée cette date, les étudiants ne peuvent plus rejoindre ni quitter un groupe." : "Affichée aux étudiants comme échéance de constitution des groupes."}
          </p>
        </div>
      </fieldset>

      <div className="flex items-start justify-between gap-4 rounded-md border p-3">
        <div className="grid gap-0.5">
          <Label htmlFor={`${idPrefix}-visible`} className="text-sm font-medium">
            Visible par les étudiants
          </Label>
          <p className="text-xs text-muted-foreground">
            {values.visible
              ? "Les étudiants de la promotion verront le projet et recevront un e-mail à la publication."
              : "Le projet reste en brouillon : les étudiants ne le voient pas. Vous pourrez le rendre visible plus tard."}
          </p>
        </div>
        <Switch id={`${idPrefix}-visible`} checked={values.visible} onCheckedChange={(checked) => set("visible", checked)} />
      </div>
    </div>
  )
}
