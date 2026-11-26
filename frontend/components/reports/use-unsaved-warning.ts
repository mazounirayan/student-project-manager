'use client'

import { useEffect } from 'react'

/** Demande au navigateur de confirmer avant de fermer ou recharger la page tant que `active` est vrai. */
export function useUnsavedWarning(active: boolean) {
  useEffect(() => {
    if (!active) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [active])
}
