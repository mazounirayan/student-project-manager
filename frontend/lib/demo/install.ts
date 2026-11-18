/**
 * Installation de l'intercepteur fetch pour la démo statique.
 * Doit être importé côté client AVANT tout appel API :
 * `import { bootstrapDemo } from "@/lib/demo/install"` (appelé au niveau module).
 */
import { STATIC_DEMO } from "./mode"
import { handleDemoRequest } from "./router"

declare global {
  interface Window {
    __spmDemoFetchInstalled?: boolean
  }
}

export function installDemoFetch(): void {
  if (typeof window === "undefined" || window.__spmDemoFetchInstalled) return

  const originalFetch = window.fetch.bind(window)

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
    if (!url.includes("/api/")) return originalFetch(input, init)

    try {
      const response = await handleDemoRequest(
        init?.method ?? (typeof input !== "string" && !(input instanceof URL) ? input.method : "GET"),
        url,
        init
      )
      if (response) return response
    } catch {
      // En cas d'échec de la démo, on retombe sur le réseau (qui échouera de toute façon).
    }
    return originalFetch(input, init)  }

  window.__spmDemoFetchInstalled = true
}

/** À appeler au niveau module d'un composant client racine. */
export function bootstrapDemo(): void {
  if (STATIC_DEMO && typeof window !== "undefined") {
    installDemoFetch()
  }
}
