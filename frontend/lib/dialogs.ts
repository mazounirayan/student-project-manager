export interface ConfirmOptions {
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  destructive?: boolean
}

type Request = ConfirmOptions & { resolve: (confirmed: boolean) => void }

let current: Request | null = null
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

export function subscribeConfirm(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getConfirmRequest() {
  return current
}

export function settleConfirm(confirmed: boolean) {
  current?.resolve(confirmed)
  current = null
  emit()
}

/** Ouvre la boîte de confirmation globale (voir ConfirmHost) et renvoie le choix de l’utilisateur. */
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    current?.resolve(false)
    current = { ...options, resolve }
    emit()
  })
}
