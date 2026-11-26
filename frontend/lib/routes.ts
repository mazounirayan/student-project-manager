"use client"

import { useSearchParams } from "next/navigation"
import { DEMO_PRERENDERED_PROJECT_IDS, STATIC_DEMO } from "@/lib/demo/mode"

/**
 * Chemin d’une page de détail de projet. Dans la démo statique, seuls les projets
 * du jeu de départ ont une page pré-générée : les projets créés ensuite réutilisent
 * la première page avec leur identifiant en paramètre `id`.
 */
export function projectPath(base: "/projects" | "/my-projects", id: number | string, suffix = ""): string {
  const numericId = Number(id)
  if (STATIC_DEMO && !DEMO_PRERENDERED_PROJECT_IDS.includes(numericId)) {
    return `${base}/${DEMO_PRERENDERED_PROJECT_IDS[0]}${suffix}?id=${numericId}`
  }
  return `${base}/${id}${suffix}`
}

/** Identifiant de projet de la page courante (voir projectPath). */
export function useRouteProjectId(paramId: string): string {
  const searchParams = useSearchParams()
  return (STATIC_DEMO && searchParams.get("id")) || paramId
}
