'use client'

import { useMemo, useRef, useState } from 'react'
import {
  DndContext, DragOverlay, closestCorners,
  PointerSensor, KeyboardSensor, useSensor, useSensors,
  type DragEndEvent, useDroppable,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { dndTransform } from '@/lib/utils'
import { Plus, Shuffle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from "sonner"
import { GroupSavePayload, saveProjectGrouping } from '@/services/groups.service'

type Student = { id: number; firstName: string; lastName: string; email: string; avatarUrl?: string; meta?: string }
type Group   = { id: number; name: string; capacity: number; members: Student[] }

const UNASSIGNED_ID = 'unassigned'
const sid = (id: number) => `s-${id}`
const gid = (id: number) => `g-${id}`

const Avatar = ({ s }: { s: Student }) => (
  <div className="flex size-8 shrink-0 items-center justify-center rounded bg-muted text-[11px] uppercase">
    {s.lastName?.[0]}{s.firstName?.[0]}
  </div>
)

function StudentRow({ s, selected = false }: { s: Student; selected?: boolean }) {
  return (
    <div className={cn(
      'flex items-center gap-2 rounded border bg-card px-2 py-1',
      'hover:bg-muted',
      selected && 'bg-primary/15 ring-1 ring-primary'
    )}>
      <Avatar s={s} />
      <div className="leading-tight">
        <div className="text-[12px] font-semibold uppercase">
          {s.lastName} <span className="normal-case">{s.firstName}</span>
        </div>
        {s.meta && <div className="text-[11px] text-primary font-semibold tracking-tight">{s.meta}</div>}
      </div>
    </div>
  )
}

function DraggableStudent({ s, selected = false }: { s: Student; selected?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sid(s.id),
    data: { type: 'student', studentId: s.id },
  })
  const style = { transform: dndTransform(transform), transition, opacity: isDragging ? .5 : 1 }
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <StudentRow s={s} selected={selected}/>
    </div>
  )
}

function DroppableBox({
  droppableId, className, children,
}: { droppableId: string; className?: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: droppableId })
  return (
    <div ref={setNodeRef} className={cn('rounded border border-dashed bg-card p-2', isOver && 'ring-2 ring-primary/40', className)}>
      {children}
    </div>
  )
}

export default function GroupsBoard({
  projectId,
  initialUnassigned,
  initialGroups,
}: {
  projectId: number
  initialUnassigned: Student[]
  initialGroups: Group[]
}) {

  const [query, setQuery] = useState('')
  const [selectedUnassignedId, setSelectedUnassignedId] = useState<number | null>(null)
  const [activeStudentId, setActiveStudentId] = useState<number | null>(null)
  const [unassigned, setUnassigned] = useState<Student[]>(initialUnassigned)
  const [groups, setGroups] = useState<Group[]>(initialGroups)
  const [saving, setSaving] = useState<"idle"|"pending"|"ok"|"error">("idle")
  const saveTimer = useRef<number | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  )

  const all = useMemo(() => {
    const m = new Map<number, Student>()
    unassigned.forEach(s => m.set(s.id, s))
    groups.forEach(g => g.members.forEach(s => m.set(s.id, s)))
    return m
  }, [unassigned, groups])

  const containers = useMemo(() => {
    const map = new Map<string, number[]>()
    map.set(UNASSIGNED_ID, unassigned?.map(s => s.id))
    groups.forEach(g => map.set(gid(g.id), g.members?.map(s => s.id)))
    return map
  }, [unassigned, groups])

  const findContainerByStudent = (id: number) => {
    for (const [cid, ids] of containers.entries()) if (ids.includes(id)) return cid
  }

  const scheduleSave = (nextUnassigned: Student[], nextGroups: Group[]) => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(async () => {
      try {
        setSaving("pending")
        const payload: GroupSavePayload = {
          groups: nextGroups?.map(g => ({ id: g.id, memberIds: g.members?.map(m => m.id) })),
          unassignedIds: nextUnassigned?.map(s => s.id),
        }
        const res = await saveProjectGrouping(projectId, payload)
        setSaving("ok")
        toast.success("Groupes enregistrés", { description: res?.message ?? "La répartition a été sauvegardée." })
      } catch (e:any) {
        setSaving("error")
        toast.error("Échec de sauvegarde", { description: e?.message ?? "Réessayez." })
      }
    }, 600) as unknown as number
  }

  const setFromLists = (unassignedIds: number[], byGroupIds: Record<number, number[]>) => {
    const nextUnassigned = unassignedIds?.map(id => all.get(id)!).filter(Boolean)
    const nextGroups = groups?.map(g => ({
      ...g,
      members: (byGroupIds[g.id] ?? [])?.map(id => all.get(id)!).filter(Boolean),
    }))
    setUnassigned(nextUnassigned)
    setGroups(nextGroups)
    scheduleSave(nextUnassigned, nextGroups)
  }

 const snapshotLists = () => {
  const u = [...(containers.get(UNASSIGNED_ID) ?? [])]
  const byG: Record<number, number[]> = {}
  groups.forEach(g => byG[g.id] = [...(containers.get(gid(g.id)) ?? [])])
  return { u, byG }
}
  const onDragStart = (e: any) => {
    const id = String(e.active.id)
    if (id.startsWith('s-')) setActiveStudentId(Number(id.slice(2)))
  }
  const onDragEnd = (e: DragEndEvent) => {
    const active = String(e.active.id)
    const over = e.over ? String(e.over.id) : undefined
    setActiveStudentId(null)
    if (!over || !active.startsWith('s-')) return

    const studentId = Number(active.slice(2))
    const from = findContainerByStudent(studentId)

    let to: string | undefined
    if (over === UNASSIGNED_ID || over.startsWith('g-')) to = over
    else if (over.startsWith('s-')) {
      const overStudentId = Number(over.slice(2))
      to = findContainerByStudent(overStudentId)
    }
    if (!from || !to || from === to) return

    if (to.startsWith('g-')) {
      const groupId = Number(to.slice(2))
      const grp = groups?.find(g => g.id === groupId)!
      const size = (containers.get(to) ?? []).length
      if (size >= grp.capacity) {
        toast.error(`${grp.name} est complet`, { description: `Capacité atteinte (${grp.capacity}/${grp.capacity}).` })
        return
      }
    }

    const { u, byG } = snapshotLists()
    const removeFrom = (cid:string) => {
      if (cid === UNASSIGNED_ID) {
        const i = u.indexOf(studentId); if (i>-1) u.splice(i,1)
      } else {
        const gidNum = Number(cid.slice(2))
        byG[gidNum] = (byG[gidNum] ?? []).filter(id => id !== studentId)
      }
    }
    const addTo = (cid:string) => {
      if (cid === UNASSIGNED_ID) u.push(studentId)
      else {
        const gidNum = Number(cid.slice(2))
        byG[gidNum] = [ ...(byG[gidNum] ?? []), studentId ]
      }
    }
    removeFrom(from); addTo(to)
    setFromLists(u, byG)
  }

  const joinGroup = (groupId:number) => {
    if (!selectedUnassignedId) return
    const grp = groups?.find(g => g.id === groupId)!
    if (grp.members.length >= grp.capacity) {
      toast.error(`${grp.name} est complet`, { description: `Capacité atteinte (${grp.capacity}/${grp.capacity}).` })
      return
    }
    const { u, byG } = snapshotLists()
    const idx = u.indexOf(selectedUnassignedId)
    if (idx > -1) u.splice(idx,1)
    byG[groupId] = [ ...(byG[groupId] ?? []), selectedUnassignedId ]
    setFromLists(u, byG)
    setSelectedUnassignedId(null)
  }

  const shuffle = <T,>(arr:T[]) => {
    const a = [...arr]; for (let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]] }
    return a
  }
const autoFormGroups = () => {
  const totalCapacity = groups.reduce((sum, g) => sum + (g.capacity - g.members.length), 0)
  
  if (unassigned.length === 0) {
    toast.info("Aucun étudiant à placer", { description: "La liste de gauche est vide." })
    return
  }
  
  if (totalCapacity < unassigned.length) {
    toast.error("Capacité insuffisante", { description: `Places restantes: ${totalCapacity}, à placer: ${unassigned.length}.` })
    return
  }
  
  const pool = shuffle(unassigned.map(s => s.id))
  const byG: Record<number, number[]> = {}
  groups.forEach(g => byG[g.id] = [...g.members.map(m => m.id)])
  
  let placed = 0
  while (pool.length > 0) {
    let progress = false
    for (const g of groups) {
      if (byG[g.id].length < g.capacity && pool.length > 0) {
        byG[g.id].push(pool.shift()!)
        placed++
        progress = true
      }
    }
    if (!progress) break
  }
  
  setFromLists(pool, byG)
  toast.success("Groupes formés", { description: `${placed} étudiants affectés automatiquement.` })
}

const unassignedFiltered = useMemo(()=>{
  const q = query.trim().toLowerCase()
  if (!q) return unassigned
  return unassigned.filter(s =>
      s.firstName.toLowerCase().includes(q) ||
      s.lastName.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q)
    )
  },[query, unassigned])

  const toggleSelectLeft = (id:number) => setSelectedUnassignedId(prev => prev===id ? null : id)

  return (
    <DndContext 
      sensors={sensors} 
      collisionDetection={closestCorners} 
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="grid gap-3 lg:grid-cols-[300px_1fr]">
        <div className="rounded border bg-muted">
          <div className="rounded-t bg-primary px-3 py-2 text-white text-sm font-semibold flex flex-wrap items-center justify-between">
            <span>Liste des étudiants</span>
            <span className="text-[11px] bg-card/20 px-2 py-0.5 rounded">{unassigned.length}</span>
          </div>

          <div className="p-2 flex flex-wrap items-center gap-2">
            <input
              className="h-8 w-full rounded border px-2 text-sm"
              placeholder="Rechercher…"
              value={query}
              onChange={(e)=>setQuery(e.target.value)}
            />
            <span className={cn(
              "text-xs px-2 py-1 rounded border",
              saving==="pending" && "border-amber-400 text-amber-600",
              saving==="ok" && "border-emerald-400 text-emerald-600",
              saving==="error" && "border-red-400 text-red-600"
            )}>
              {saving==="pending" ? "Enregistrement…" : saving==="ok" ? "Enregistré" : saving==="error" ? "Erreur" : "Prêt"}
            </span>
          </div>

          <div className="p-2 pt-0">
            <SortableContext items={unassignedFiltered?.map(s=>sid(s.id))} strategy={verticalListSortingStrategy}>
              <DroppableBox droppableId={UNASSIGNED_ID} className="min-h-[420px] max-h-[calc(100vh-220px)] overflow-y-auto space-y-1">
                {unassignedFiltered.length === 0
                  ? <div className="text-[12px] text-muted-foreground">Aucun étudiant</div>
                  : unassignedFiltered?.map(s => (
                      <div key={s.id} onClick={()=>toggleSelectLeft(s.id)}>
                        <DraggableStudent s={s} selected={selectedUnassignedId===s.id}/>
                      </div>
                    ))
                }
              </DroppableBox>
            </SortableContext>
          </div>
        </div>

        <div className="space-y-2">
          <button
            className="inline-flex items-center gap-2 rounded border px-3 py-1.5 text-sm text-primary hover:bg-primary/10"
            onClick={autoFormGroups}
            title="Former automatiquement (aléatoire, respecte la capacité)"
          >
            <Shuffle className="h-4 w-4"/> Former les groupes automatiquement
          </button>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {groups?.map(g=>{
              const full = g.members.length >= g.capacity
              return (
                <div key={g.id} className="rounded border bg-card">
                  <div className="rounded-t bg-primary px-3 py-1.5 text-white flex flex-wrap items-center justify-between">
                    <div className="font-semibold text-sm">{g.name}</div>
                    <div className="text-[11px] flex flex-wrap items-center gap-2">
                      <span>{g.members.length}/{g.capacity}</span>
                      {full && <span className="rounded bg-card/15 px-1.5 py-0.5">complet</span>}
                    </div>
                  </div>

                  <div className="p-2">
                    <SortableContext items={g.members?.map(s=>sid(s.id))} strategy={verticalListSortingStrategy}>
                      <DroppableBox droppableId={gid(g.id)} className="min-h-20 bg-muted/50 p-2 divide-y">
                        {g.members.length === 0
                          ? <div className="text-[12px] text-muted-foreground">Aucun membre</div>
                          : g.members?.map((s,i)=>(
                              <div key={s.id} className={cn(i>0 && 'pt-2','pb-2')}>
                                <DraggableStudent s={s}/>
                              </div>
                            ))
                        }
                      </DroppableBox>
                    </SortableContext>

                    <button
                      className={cn(
                        'mt-2 flex w-full items-center justify-center gap-2 rounded border px-2 py-1.5 text-sm',
                        full || !selectedUnassignedId
                          ? 'text-muted-foreground bg-muted/50 cursor-not-allowed'
                          : 'text-primary hover:bg-primary/10'
                      )}
                      onClick={()=>joinGroup(g.id)}
                      disabled={full || !selectedUnassignedId}
                      title={full ? "Groupe complet" : (!selectedUnassignedId ? "Sélectionnez d’abord un étudiant à gauche" : "Ajouter l’étudiant sélectionné")}
                    >
                      <Plus className="h-4 w-4"/> Rejoindre le groupe
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeStudentId ? (
          <div className="rounded border bg-card px-2 py-1">
            <StudentRow s={all.get(activeStudentId)!}/>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
