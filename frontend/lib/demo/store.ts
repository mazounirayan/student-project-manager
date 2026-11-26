import { buildDemoDb } from "./seed"
import { DEMO_DB_KEY } from "./mode"
import type { DemoDb } from "./types"

let cache: DemoDb | null = null

/** Charge la base de démo depuis le localStorage (ou la réinitialise). */
export function loadDemoDb(): DemoDb {
  if (cache) return cache
  if (typeof window === "undefined") {
    // Hors navigateur (tests, scripts) : base en mémoire, sans persistance.
    cache = buildDemoDb()
    return cache
  }
  try {
    const raw = window.localStorage.getItem(DEMO_DB_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as DemoDb
      if (parsed && Array.isArray(parsed.users) && Array.isArray(parsed.projects)) {
        cache = parsed
        return cache
      }
    }
  } catch {
    // localStorage illisible : on repart du jeu de départ
  }
  cache = buildDemoDb()
  persist()
  return cache
}

export function persist(): void {
  if (typeof window === "undefined" || !cache) return
  try {
    window.localStorage.setItem(DEMO_DB_KEY, JSON.stringify(cache))
  } catch {
    // Quota dépassé : la démo continue en mémoire pour cette session.
  }
}

/** Remet la base de démo à son état d’origine. */
export function resetDemoDb(): DemoDb {
  cache = buildDemoDb()
  persist()
  return cache
}

/** Génère un nouvel identifiant pour une entité créée en démo. */
export function nextId(db: DemoDb): number {
  db.seq += 1
  return db.seq
}
