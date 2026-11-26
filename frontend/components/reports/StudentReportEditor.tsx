'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import { AlertTriangle, Bold, Code, Heading2, Heading3, Italic, List, ListOrdered, Quote, Redo, Undo } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ApiError, apiFetch, apiGet, apiPut, errorMessage } from '@/lib/api'
import { confirmAction } from '@/lib/dialogs'
import { plural } from '@/lib/format'
import { fullName } from '@/lib/people'
import { countWords, formatSavedAt, type Author, type GroupReport, type SectionConfig, type SectionContent } from '@/lib/reports'
import { cn } from '@/lib/utils'
import { RICH_TEXT_CLASS, ReportContent } from './ReportContent'

type SaveStatus = 'saved' | 'dirty' | 'saving' | 'error' | 'conflict'

/** Délai entre la dernière frappe et l’enregistrement automatique. */
const AUTOSAVE_DELAY = 2500

export const sectionAnchor = (sectionId: number) => `section-${sectionId}`

interface StudentReportEditorProps {
  projectId: number
  groupId: number
  section: SectionConfig
  position: number
  /** Dernière version connue sur le serveur (mise à jour régulièrement par la page). */
  server?: SectionContent
  currentUserId: number
  onSaved: (saved: SectionContent) => void
  /** Vrai tant que le texte affiché n’est pas enregistré (frappe en attente, échec, conflit). */
  onUnsavedChange: (sectionId: number, unsaved: boolean) => void
  /** Permet à la page d’enregistrer toutes les sections avant de rendre le rapport. */
  registerFlush: (sectionId: number, flush: (() => Promise<boolean>) | null) => void
  /** Le serveur a refusé l’enregistrement (échéance passée, rapport déjà rendu) : la page se recharge. */
  onRefused: () => void
}

/** Une section à rédiger : consignes à gauche, éditeur à droite, enregistrement automatique et signalement des modifications d’un coéquipier. */
export function StudentReportEditor({
  projectId,
  groupId,
  section,
  position,
  server,
  currentUserId,
  onSaved,
  onUnsavedChange,
  registerFlush,
  onRefused,
}: StudentReportEditorProps) {
  const [status, setStatus] = useState<SaveStatus>('saved')
  const [errorText, setErrorText] = useState('')
  const [lastSave, setLastSave] = useState<{ at: string; by: Author | null } | null>(server ? { at: server.updatedAt, by: server.updatedBy ?? null } : null)
  const [conflict, setConflict] = useState<SectionContent | null>(null)
  const [remoteNote, setRemoteNote] = useState<string | null>(null)
  const [words, setWords] = useState(() => countWords(server?.content))

  /** Date de la version du serveur dont part le texte affiché : sert à repérer qu’un coéquipier a enregistré entre-temps. */
  const baseRef = useRef<string | null>(server?.updatedAt ?? null)
  const htmlRef = useRef(server?.content ?? '')
  const dirtyRef = useRef(false)
  const conflictRef = useRef(false)
  const inflight = useRef<Promise<boolean> | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const saveRef = useRef<() => Promise<boolean>>(async () => true)

  const editor = useEditor({
    extensions: [StarterKit, Placeholder.configure({ placeholder: 'Commencez à rédiger…' }), CharacterCount],
    content: server?.content ?? '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(RICH_TEXT_CLASS, 'min-h-[14rem] px-4 py-3 outline-none'),
        'aria-label': `Texte de la section ${section.title}`,
        'aria-multiline': 'true',
      },
      handleKeyDown: (_view, event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
          event.preventDefault()
          void saveRef.current()
          return true
        }
        return false
      },
    },
    onUpdate: ({ editor: current }) => {
      htmlRef.current = current.isEmpty ? '' : current.getHTML()
      setWords(current.storage.characterCount.words())
      dirtyRef.current = true
      onUnsavedChange(section.id, true)
      setStatus((previous) => (previous === 'conflict' ? previous : 'dirty'))
      if (!conflictRef.current) {
        clearTimeout(timer.current)
        timer.current = setTimeout(() => void saveRef.current(), AUTOSAVE_DELAY)
      }
    },
  })

  const toolbar = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      current
        ? {
            bold: current.isActive('bold'),
            italic: current.isActive('italic'),
            h2: current.isActive('heading', { level: 2 }),
            h3: current.isActive('heading', { level: 3 }),
            bullet: current.isActive('bulletList'),
            ordered: current.isActive('orderedList'),
            quote: current.isActive('blockquote'),
            code: current.isActive('codeBlock'),
            canUndo: current.can().undo(),
            canRedo: current.can().redo(),
          }
        : null,
  })

  const showConflict = useCallback((theirs: SectionContent) => {
    clearTimeout(timer.current)
    conflictRef.current = true
    setConflict(theirs)
    setStatus('conflict')
    onUnsavedChange(section.id, true)
  }, [onUnsavedChange, section.id])

  const save = async (): Promise<boolean> => {
    if (inflight.current) await inflight.current
    if (conflictRef.current) return false
    if (!dirtyRef.current) return true
    clearTimeout(timer.current)

    const html = htmlRef.current
    setStatus('saving')
    const run = (async () => {
      try {
        const result = await apiPut<SectionContent>(`/reports/sections/${section.id}/content`, {
          groupId,
          content: html,
          baseUpdatedAt: baseRef.current,
        })
        baseRef.current = result.updatedAt ?? baseRef.current
        const typedSince = htmlRef.current !== html
        dirtyRef.current = typedSince
        setLastSave({ at: result.updatedAt, by: result.updatedBy ?? null })
        setErrorText('')
        setRemoteNote(null)
        setStatus(typedSince ? 'dirty' : 'saved')
        if (typedSince) timer.current = setTimeout(() => void saveRef.current(), AUTOSAVE_DELAY)
        else onUnsavedChange(section.id, false)
        onSaved({ ...result, content: html })
        return true
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) {
          const report = await apiGet<GroupReport>(`/reports/groups/${groupId}/projects/${projectId}`).catch(() => null)
          const theirs = report?.sections.find((item) => item.sectionConfigId === section.id)
          if (theirs) {
            showConflict(theirs)
            return false
          }
        }
        setErrorText(errorMessage(error, 'Impossible d’enregistrer cette section.'))
        setStatus('error')
        if (error instanceof ApiError && (error.status === 403 || error.status === 404)) onRefused()
        return false
      }
    })()
    inflight.current = run
    try {
      return await run
    } finally {
      inflight.current = null
    }
  }
  saveRef.current = save

  useEffect(() => {
    registerFlush(section.id, () => saveRef.current())
    return () => registerFlush(section.id, null)
  }, [registerFlush, section.id])

  // Filet de sécurité pour une frappe continue, et dernier envoi quand on quitte la page avec du texte en attente.
  useEffect(() => {
    const interval = setInterval(() => {
      if (dirtyRef.current && !conflictRef.current && !inflight.current) void saveRef.current()
    }, 20_000)
    return () => {
      clearInterval(interval)
      clearTimeout(timer.current)
      if (dirtyRef.current && !conflictRef.current) {
        apiFetch(`/reports/sections/${section.id}/content`, {
          method: 'PUT',
          body: JSON.stringify({ groupId, content: htmlRef.current, baseUpdatedAt: baseRef.current }),
          keepalive: true,
        }).catch(() => undefined)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Un coéquipier a enregistré cette section : on reprend son texte si on n’a rien modifié, sinon on signale le conflit.
  const serverVersion = server?.updatedAt
  useEffect(() => {
    if (!editor || !server || server.updatedAt === baseRef.current) return
    if (baseRef.current && new Date(server.updatedAt) < new Date(baseRef.current)) return
    if (server.content === htmlRef.current) {
      baseRef.current = server.updatedAt
      return
    }
    if (dirtyRef.current || inflight.current) {
      showConflict(server)
      return
    }
    editor.commands.setContent(server.content, { emitUpdate: false })
    htmlRef.current = editor.isEmpty ? '' : editor.getHTML()
    baseRef.current = server.updatedAt
    setWords(editor.storage.characterCount.words())
    setLastSave({ at: server.updatedAt, by: server.updatedBy ?? null })
    setRemoteNote(`Mise à jour avec la version de ${server.updatedBy ? fullName(server.updatedBy) : 'votre groupe'} ${formatSavedAt(server.updatedAt)}.`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverVersion, editor])

  const keepMine = async () => {
    if (!conflict) return
    baseRef.current = conflict.updatedAt
    conflictRef.current = false
    dirtyRef.current = true
    setConflict(null)
    await saveRef.current()
  }

  const takeTheirs = async () => {
    if (!conflict || !editor) return
    const confirmed = await confirmAction({
      title: 'Reprendre la version de votre coéquipier ?',
      description: 'Le texte que vous avez écrit dans cette section depuis votre dernier enregistrement sera remplacé.',
      confirmText: 'Reprendre sa version',
      destructive: true,
    })
    if (!confirmed) return
    editor.commands.setContent(conflict.content, { emitUpdate: false })
    htmlRef.current = editor.isEmpty ? '' : editor.getHTML()
    baseRef.current = conflict.updatedAt
    conflictRef.current = false
    dirtyRef.current = false
    setWords(editor.storage.characterCount.words())
    setLastSave({ at: conflict.updatedAt, by: conflict.updatedBy ?? null })
    setConflict(null)
    setStatus('saved')
    onUnsavedChange(section.id, false)
    onSaved(conflict)
  }

  if (!editor) return null

  const limit = section.wordLimit
  const over = Boolean(limit && words > limit)
  const author = lastSave?.by && lastSave.by.id !== currentUserId ? fullName(lastSave.by) : null

  const statusText =
    status === 'saving'
      ? 'Enregistrement…'
      : status === 'dirty'
        ? 'Modifications non enregistrées'
        : status === 'conflict'
          ? 'Non enregistré : un coéquipier a modifié cette section'
          : status === 'error'
            ? `Échec de l’enregistrement : ${errorText}`
            : lastSave
              ? `Enregistré ${formatSavedAt(lastSave.at)}${author ? `, par ${author}` : ''}`
              : 'Rien d’enregistré pour l’instant'

  return (
    <article id={sectionAnchor(section.id)} aria-labelledby={`${sectionAnchor(section.id)}-title`} className="scroll-mt-4 overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
      <div className="grid lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="space-y-3 border-b bg-muted/30 p-5 lg:border-b-0 lg:border-r">
          <div className="space-y-3 lg:sticky lg:top-4">
            <div className="space-y-2">
              <h3 id={`${sectionAnchor(section.id)}-title`} className="font-semibold leading-snug">
                {position}. {section.title}
              </h3>
              <Badge variant={section.required ? 'default' : 'outline'}>{section.required ? 'Obligatoire' : 'Facultative'}</Badge>
            </div>
            {section.description ? (
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Consignes</p>
                <p className="whitespace-pre-line text-sm leading-relaxed">{section.description}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Pas de consigne particulière pour cette section.</p>
            )}
            <div className="space-y-1.5" aria-live="polite">
              <p className={cn('text-sm tabular-nums', over ? 'font-medium text-destructive' : 'text-muted-foreground')}>
                {limit ? `${words} / ${limit} mots` : plural(words, 'mot')}
              </p>
              {limit && (
                <Progress
                  value={Math.min(100, (words / limit) * 100)}
                  aria-label={`${words} mots sur ${limit} au maximum`}
                  className={cn('h-1.5', over && 'bg-destructive/20 [&_[data-slot=progress-indicator]]:bg-destructive')}
                />
              )}
              {over && <p className="text-xs text-destructive">Limite dépassée de {plural(words - (limit as number), 'mot')}. Elle ne bloque pas l’enregistrement.</p>}
            </div>
          </div>
        </aside>

        <div className="min-w-0 space-y-3 p-4">
          {conflict && (
            <div role="alert" className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
              <p className="flex items-start gap-2 font-medium">
                <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                <span>
                  {conflict.updatedBy ? fullName(conflict.updatedBy) : 'Un membre de votre groupe'} a enregistré une version plus récente de cette section ({formatSavedAt(conflict.updatedAt)}). Votre texte n’est pas enregistré : choisissez quelle version garder.
                </span>
              </p>
              <details className="rounded-md border bg-background px-3 py-2">
                <summary className="cursor-pointer text-sm font-medium">Lire sa version</summary>
                <div className="mt-2 max-h-72 overflow-y-auto">
                  <ReportContent>{conflict.content || ' '}</ReportContent>
                </div>
              </details>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={keepMine}>
                  Garder mon texte
                </Button>
                <Button size="sm" variant="outline" onClick={takeTheirs}>
                  Reprendre sa version
                </Button>
              </div>
            </div>
          )}

          <div role="toolbar" aria-label={`Mise en forme de la section ${section.title}`} className="flex flex-wrap items-center gap-1 rounded-lg border bg-muted/40 p-1">
            <ToolButton label="Gras" hint="Ctrl+B" active={toolbar?.bold} onClick={() => editor.chain().focus().toggleBold().run()}>
              <Bold />
            </ToolButton>
            <ToolButton label="Italique" hint="Ctrl+I" active={toolbar?.italic} onClick={() => editor.chain().focus().toggleItalic().run()}>
              <Italic />
            </ToolButton>
            <Divider />
            <ToolButton label="Titre" active={toolbar?.h2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
              <Heading2 />
            </ToolButton>
            <ToolButton label="Sous-titre" active={toolbar?.h3} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
              <Heading3 />
            </ToolButton>
            <Divider />
            <ToolButton label="Liste à puces" active={toolbar?.bullet} onClick={() => editor.chain().focus().toggleBulletList().run()}>
              <List />
            </ToolButton>
            <ToolButton label="Liste numérotée" active={toolbar?.ordered} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
              <ListOrdered />
            </ToolButton>
            <ToolButton label="Citation" active={toolbar?.quote} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
              <Quote />
            </ToolButton>
            <ToolButton label="Bloc de code" active={toolbar?.code} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
              <Code />
            </ToolButton>
            <Divider />
            <ToolButton label="Annuler" hint="Ctrl+Z" disabled={!toolbar?.canUndo} onClick={() => editor.chain().focus().undo().run()}>
              <Undo />
            </ToolButton>
            <ToolButton label="Rétablir" hint="Ctrl+Maj+Z" disabled={!toolbar?.canRedo} onClick={() => editor.chain().focus().redo().run()}>
              <Redo />
            </ToolButton>
          </div>

          <div className="rounded-lg border bg-background transition-shadow focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
            <EditorContent editor={editor} />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p role="status" className={cn('text-sm', status === 'error' || status === 'conflict' ? 'text-destructive' : 'text-muted-foreground')}>
              {statusText}
              {remoteNote && status !== 'error' && status !== 'conflict' && <span className="block text-xs">{remoteNote}</span>}
            </p>
            <Button variant={status === 'dirty' || status === 'error' ? 'default' : 'outline'} size="sm" onClick={() => void save()} disabled={status === 'saving' || status === 'conflict'} title="Ctrl+S">
              {status === 'saving' ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Enregistrement automatique quelques secondes après la dernière frappe, ou avec Ctrl+S.</p>
        </div>
      </div>
    </article>
  )
}

function Divider() {
  return <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-border" />
}

interface ToolButtonProps {
  label: string
  hint?: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}

function ToolButton({ label, hint, active, disabled, onClick, children }: ToolButtonProps) {
  const isToggle = active !== undefined
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn('h-8 w-8', active && 'bg-accent text-accent-foreground')}
      aria-label={label}
      aria-pressed={isToggle ? active : undefined}
      title={hint ? `${label} (${hint})` : label}
      disabled={disabled}
      // Garde le focus dans l’éditeur : le clic sur le bouton ne doit pas désélectionner le texte.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}
