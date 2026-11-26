"use client";

import { BACKEND_URL, assertOk } from "@/lib/api"
import type React from "react";
import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";

type Promotion = { id: number; name: string };

type ProjectDTO = {
  id: number;
  name: string;
  description?: string | null;
  status: "draft" | "visible";
  minGroupSize?: number | null;
  maxGroupSize?: number | null;
  groupFormationRule?: "manual" | "random" | "free" | null;
  groupFormationDeadline?: string | null; // ISO côté API
  promotionId?: number | null;
};

const toLocalDT = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export function EditProjectDialog({
  projectId,
  trigger,
  onSaved,
}: {
  projectId: number | string;
  trigger: React.ReactNode;
  onSaved?: (updated: ProjectDTO) => void;
}) {
  const [open, setOpen] = useState(false);

  const [promos, setPromos] = useState<Promotion[]>([]);
  const [proj, setProj]     = useState<ProjectDTO | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [promotionId, setPromotionId] = useState<string>("");
  const [status, setStatus] = useState<"draft" | "visible">("draft");
  const [minGroupSize, setMinGroupSize] = useState<string>("");
  const [maxGroupSize, setMaxGroupSize] = useState<string>("");
  const [groupFormationRule, setGroupFormationRule] = useState<"free" | "manual" | "random">("free");
  const [deadline, setDeadline] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancel = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        if (!token) throw new Error("Session expirée, reconnectez-vous");

        const [r1, r2] = await Promise.all([
          fetch(`${BACKEND_URL}/api/projects/${projectId}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${BACKEND_URL}/api/promotions/my`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        await assertOk(r1);
        await assertOk(r2);

        const p: ProjectDTO = await r1.json();
        const ps: Promotion[] = await r2.json();
        if (cancel) return;

        setProj(p);
        setPromos(ps);

        setName(p.name ?? "");
        setDescription(p.description ?? "");
        setPromotionId(p.promotionId ? String(p.promotionId) : "");
        setStatus(p.status ?? "draft");
        setMinGroupSize(p.minGroupSize != null ? String(p.minGroupSize) : "");
        setMaxGroupSize(p.maxGroupSize != null ? String(p.maxGroupSize) : "");
        setGroupFormationRule((p.groupFormationRule as any) ?? "free");
        setDeadline(toLocalDT(p.groupFormationDeadline));
      } catch (e: any) {
        setError(e?.message ?? "Erreur de chargement");
      } finally {
        setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [open, projectId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !promotionId) return;

    try {
      setSaving(true);
      setError(null);
      const token = localStorage.getItem("token");
      if (!token) throw new Error("No token found");

      const body: Partial<ProjectDTO> & { promotionId?: number } = {
        name: name.trim(),
        description: description.trim(),
        status,
        groupFormationRule,
      };
      if (promotionId) body.promotionId = Number(promotionId);
      if (minGroupSize !== "") body.minGroupSize = Number.parseInt(minGroupSize, 10);
      if (maxGroupSize !== "") body.maxGroupSize = Number.parseInt(maxGroupSize, 10);
      body.groupFormationDeadline = deadline ? new Date(deadline).toISOString() : null;

      const res = await fetch(`${BACKEND_URL}/api/projects/${projectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      await assertOk(res)
      const updated: ProjectDTO = await res.json().catch(() => ({ ...(proj as any), ...body }));
      onSaved?.(updated);
      setOpen(false);
    } catch (e: any) {
      setError(e?.message ?? "Échec de l’enregistrement");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Modifier le projet</DialogTitle>
          <DialogDescription>Met à jour les informations du projet.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="p-4">Chargement…</div>
        ) : (
          <form onSubmit={submit} className="space-y-5">
            {error && (
              <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="name">Nom *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="desc">Description</Label>
              <Textarea id="desc" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Promotion *</Label>
                <Select value={promotionId} onValueChange={setPromotionId}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner une promotion" /></SelectTrigger>
                  <SelectContent>
                    {promos.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Statut</Label>
                <Select value={status} onValueChange={(v: "draft" | "visible") => setStatus(v)}>
                  <SelectTrigger><SelectValue placeholder="Choisir un statut" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Brouillon</SelectItem>
                    <SelectItem value="visible">Visible</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="min">Taille min du groupe</Label>
                <Input id="min" type="number" min={0} value={minGroupSize} onChange={(e) => setMinGroupSize(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max">Taille max du groupe</Label>
                <Input id="max" type="number" min={1} value={maxGroupSize} onChange={(e) => setMaxGroupSize(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Formation des groupes</Label>
                <Select value={groupFormationRule} onValueChange={(v: "free" | "manual" | "random") => setGroupFormationRule(v)}>
                  <SelectTrigger><SelectValue placeholder="Choisir un mode" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Libre</SelectItem>
                    <SelectItem value="manual">Manuelle</SelectItem>
                    <SelectItem value="random">Aléatoire</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deadline">Date limite de formation</Label>
              <Input id="deadline" type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
              <Button type="submit" disabled={!name.trim() || !promotionId || saving}>
                {saving ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
