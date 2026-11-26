'use client'

import { formatTime } from "@/lib/format"
import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
    DndContext,
    closestCenter,
    PointerSensor,
    KeyboardSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core'
import {
    arrayMove,
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { dndTransform } from '@/lib/utils'
import { GripVertical, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface DefenseItem {
    id: number
    startTime: string
    endTime: string
    orderIndex: number
    location?: string
    group: { id: number; name: string }
}

type Props = {
    defenses?: any
    autoSave?: boolean
    onOrderChange?: (nextOrderedDefenses: DefenseItem[]) => Promise<any> | void
    saveDebounceMs?: number
}

// Sortable row component — utilise useSortable (importé depuis @dnd-kit/sortable)
function SortableRow({ item }: { item: DefenseItem }) {
    const id = `d-${item.id}`
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
    const style = {
        transform: dndTransform(transform),
        transition,
        opacity: isDragging ? 0.85 : 1,
    } as React.CSSProperties

    const formattedTime = (iso?: string) =>
        iso ? formatTime(iso) : '-'

    return (
        <tr ref={setNodeRef} style={style} className="bg-card">
            <td className="p-2 text-sm whitespace-nowrap">
                <span className="inline-flex items-center gap-2">
                    <span className="cursor-grab" {...listeners} {...attributes} title="Glisser pour réordonner">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                    </span>
                    <span className="font-medium">{item.orderIndex}</span>
                </span>
            </td>
            <td className="p-2 text-sm">{item.group?.name ?? '—'}</td>
            <td className="p-2 text-sm whitespace-nowrap">{formattedTime(item.startTime)} — {formattedTime(item.endTime)}</td>
            <td className="p-2 text-sm">{item.location ?? '—'}</td>
        </tr>
    )
}

export default function DefenseOrderTable({
    defenses,
    autoSave = true,
    onOrderChange,
    saveDebounceMs = 600,
}: Props) {
    // Normalisation défensive : accepte plusieurs shapes de payload
    const normalized = useMemo<DefenseItem[]>(() => {
        if (!defenses) return []
        if (Array.isArray(defenses)) return defenses as DefenseItem[]
        if (Array.isArray((defenses as any).defenses)) return (defenses as any).defenses
        if (Array.isArray((defenses as any).data)) return (defenses as any).data
        const possibleKeys = ['items', 'results', 'rows', 'list']
        for (const k of possibleKeys) {
            if (Array.isArray((defenses as any)[k])) return (defenses as any)[k]
        }
        if (typeof defenses === 'object') {
            const vals = Object.values(defenses).flat().filter(v => v && typeof v === 'object')
            if (Array.isArray(vals) && vals.length) return vals as DefenseItem[]
        }
        return []
    }, [defenses])

    const initial = useMemo(() => {
        return [...normalized].sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
    }, [normalized])

    const [items, setItems] = useState<DefenseItem[]>(initial)
    const [savedSnapshot, setSavedSnapshot] = useState<DefenseItem[]>(initial)
    const [savingState, setSavingState] = useState<'idle' | 'pending' | 'ok' | 'error'>('idle')
    const saveTimer = useRef<number | null>(null)

    useEffect(() => {
        setItems(initial)
        setSavedSnapshot(initial)
    }, [initial])

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(KeyboardSensor)
    )

    const computeWithOrderIndex = (list: DefenseItem[]) => list?.map((d, i) => ({ ...d, orderIndex: i + 1 }))

    const scheduleSave = (next: DefenseItem[]) => {
        if (!autoSave || !onOrderChange) return
        if (saveTimer.current) window.clearTimeout(saveTimer.current)
        saveTimer.current = window.setTimeout(async () => {
            setSavingState('pending')
            try {
                const payload = computeWithOrderIndex(next)
                await onOrderChange(payload)
                setSavedSnapshot(payload)
                setSavingState('ok')
                setTimeout(() => setSavingState('idle'), 1000)
            } catch (e) {
                setSavingState('error')
            }
        }, saveDebounceMs) as unknown as number
    }

    const handleSaveNow = async () => {
        if (!onOrderChange) return
        setSavingState('pending')
        try {
            const payload = computeWithOrderIndex(items)
            await onOrderChange(payload)
            setSavedSnapshot(payload)
            setSavingState('ok')
            setTimeout(() => setSavingState('idle'), 1000)
        } catch (e) {
            setSavingState('error')
        }
    }

    const handleCancel = () => {
        if (saveTimer.current) { window.clearTimeout(saveTimer.current); saveTimer.current = null }
        setItems(savedSnapshot)
        setSavingState('idle')
    }

    const onDragEnd = (event: DragEndEvent) => {
        const { active, over } = event
        if (!over) return
        const activeId = String(active.id)
        const overId = String(over.id)
        if (activeId === overId) return

        const oldIndex = items.findIndex(i => `d-${i.id}` === activeId)
        const newIndex = items.findIndex(i => `d-${i.id}` === overId)
        if (oldIndex === -1 || newIndex === -1) return

        const next = arrayMove(items, oldIndex, newIndex)
        const nextWithIndex = computeWithOrderIndex(next)
        setItems(nextWithIndex)
        scheduleSave(nextWithIndex)
    }
    

    return (
        <div className="overflow-x-auto rounded-md border bg-card">
            <div className="flex flex-wrap items-center justify-between px-4 py-2 border-b">
                <div className="flex flex-wrap items-center gap-3">
                    <h4 className="text-sm font-semibold">Ordre de passage</h4>
                    <div className="text-xs text-muted-foreground">Glissez les lignes pour changer l’ordre</div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <div className="text-xs px-2 py-1 rounded border">
                        {savingState === 'pending' ? 'Enregistrement…' : savingState === 'ok' ? 'Enregistré' : savingState === 'error' ? 'Erreur' : 'Prêt'}
                    </div>
                    <Button variant="ghost" size="sm" onClick={handleCancel} title="Annuler les modifications">
                        <X className="h-4 w-4" />
                    </Button>
                    <Button onClick={handleSaveNow} size="sm" title="Enregistrer maintenant">
                        <Save className="h-4 w-4 mr-2" /> Enregistrer
                    </Button>
                </div>
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                <SortableContext items={items?.map(i => `d-${i.id}`)} strategy={verticalListSortingStrategy}>
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="bg-muted/50">
                                <th className="p-2 text-left">Ordre</th>
                                <th className="p-2 text-left">Groupe</th>
                                <th className="p-2 text-left">Heure</th>
                                <th className="p-2 text-left">Lieu</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items?.map((item) => (
                                <SortableRow key={`d-${item.id}`} item={item} />
                            ))}
                        </tbody>
                    </table>
                </SortableContext>
            </DndContext>
        </div>
    )
}
