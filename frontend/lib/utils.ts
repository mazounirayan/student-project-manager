import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Transformation CSS d’un élément déplacé avec dnd-kit. */
export function dndTransform(transform: { x: number; y: number; scaleX?: number; scaleY?: number } | null) {
  if (!transform) return undefined
  const { x, y, scaleX = 1, scaleY = 1 } = transform
  return `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0) scaleX(${scaleX}) scaleY(${scaleY})`
}
