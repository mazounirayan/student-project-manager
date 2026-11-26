"use client"

import { useEffect } from "react"
import { APP_NAME } from "@/lib/app"

/**
 * Titre de l’onglet pour une page dont le nom n’est connu qu’après chargement (le projet ouvert, par exemple).
 * Avant le chargement, c’est le titre de la rubrique (voir les layout.tsx) qui s’affiche.
 */
export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    if (title) document.title = `${title} · ${APP_NAME}`
  }, [title])
}
