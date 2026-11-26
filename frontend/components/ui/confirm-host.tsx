'use client'

import { useRef, useSyncExternalStore } from 'react'
import { getConfirmRequest, settleConfirm, subscribeConfirm } from '@/lib/dialogs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** À monter une seule fois dans le layout : affiche les confirmations demandées par confirmAction(). */
export function ConfirmHost() {
  const current = useSyncExternalStore(subscribeConfirm, getConfirmRequest, () => null)
  // Pendant l'animation de fermeture, la boîte garde le texte de la dernière demande au lieu de se vider.
  const lastRequest = useRef(current)
  if (current) lastRequest.current = current
  const request = current ?? lastRequest.current

  return (
    <AlertDialog open={current !== null} onOpenChange={(open) => !open && settleConfirm(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{request?.title}</AlertDialogTitle>
          {request?.description && <AlertDialogDescription>{request.description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{request?.cancelText ?? 'Annuler'}</AlertDialogCancel>
          <AlertDialogAction
            className={cn(request?.destructive && buttonVariants({ variant: 'destructive' }))}
            onClick={() => settleConfirm(true)}
          >
            {request?.confirmText ?? 'Confirmer'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
