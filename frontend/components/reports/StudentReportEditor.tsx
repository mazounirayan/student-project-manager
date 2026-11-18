// components/reports/StudentReportEditor.tsx
'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Heading2, 
  Heading3,
  Code,
  Quote,
  Undo,
  Redo,
  Save,
  FileText
} from 'lucide-react'
import { useState, useEffect } from 'react'
import Swal from 'sweetalert2'
const NEST_BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'

interface StudentReportEditorProps {
  projectId: number
  groupId: number
  sectionId: number
  sectionTitle: string
  sectionDescription?: string
  wordLimit?: number
  required: boolean
  initialContent?: string
  format: 'markdown' | 'html'
  onSave?: () => void
}

export function StudentReportEditor({
  projectId,
  groupId,
  sectionId,
  sectionTitle,
  sectionDescription,
  wordLimit,
  required,
  initialContent = '',
  format,
  onSave
}: StudentReportEditorProps) {
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Commencez à rédiger...',
      }),
      CharacterCount.configure({
        limit: wordLimit ? wordLimit * 6 : undefined,
      }),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[300px] p-4',
      },
    },
     immediatelyRender: false,
  })

  useEffect(() => {
    if (!editor) return

    const interval = setInterval(() => {
      saveContent(true)
    }, 30000)

    return () => clearInterval(interval)
  }, [editor])

  const saveContent = async (silent = false) => {
    if (!editor) return

    setSaving(true)
    try {
      const token = localStorage.getItem('token')
      const content = editor.getHTML()
      
      const response = await fetch(
        `${NEST_BACKEND_URL}/api/reports/sections/${sectionId}/content`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ 
            content,
            groupId 
          })
        }
      )

      if (!response.ok) throw new Error('Erreur sauvegarde')

      setLastSaved(new Date())
      
      if (!silent) {
        await Swal.fire({
          title: 'Sauvegardé',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false
        })
      }

      onSave?.()
    } catch (error) {
      if (!silent) {
        await Swal.fire({
          title: 'Erreur',
          text: 'Impossible de sauvegarder',
          icon: 'error'
        })
      }
    } finally {
      setSaving(false)
    }
  }

  if (!editor) return null

  const wordCount = editor.storage.characterCount.words()
  const isOverLimit = Boolean(wordLimit && wordCount > wordLimit)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {sectionTitle}
              {required && <Badge variant="destructive">Obligatoire</Badge>}
            </CardTitle>
            {sectionDescription && (
              <p className="text-sm text-muted-foreground">{sectionDescription}</p>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {wordLimit && (
              <Badge variant={isOverLimit ? 'destructive' : 'secondary'}>
                {wordCount} / {wordLimit} mots
              </Badge>
            )}
            {lastSaved && (
              <span className="text-xs text-muted-foreground">
                Sauvegardé à {lastSaved.toLocaleTimeString('fr-FR')}
              </span>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Barre d'outils */}
        <div className="flex flex-wrap gap-2 p-2 border rounded-lg bg-muted/50">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={editor.isActive('bold') ? 'bg-accent' : ''}
          >
            <Bold className="h-4 w-4" />
          </Button>
          
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={editor.isActive('italic') ? 'bg-accent' : ''}
          >
            <Italic className="h-4 w-4" />
          </Button>

          <div className="w-px h-6 bg-border" />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={editor.isActive('heading', { level: 2 }) ? 'bg-accent' : ''}
          >
            <Heading2 className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={editor.isActive('heading', { level: 3 }) ? 'bg-accent' : ''}
          >
            <Heading3 className="h-4 w-4" />
          </Button>

          <div className="w-px h-6 bg-border" />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={editor.isActive('bulletList') ? 'bg-accent' : ''}
          >
            <List className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={editor.isActive('orderedList') ? 'bg-accent' : ''}
          >
            <ListOrdered className="h-4 w-4" />
          </Button>

          <div className="w-px h-6 bg-border" />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={editor.isActive('blockquote') ? 'bg-accent' : ''}
          >
            <Quote className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            className={editor.isActive('codeBlock') ? 'bg-accent' : ''}
          >
            <Code className="h-4 w-4" />
          </Button>

          <div className="w-px h-6 bg-border" />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
          >
            <Undo className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
          >
            <Redo className="h-4 w-4" />
          </Button>
        </div>

        {/* Éditeur */}
        <div className="border rounded-lg bg-background">
          <EditorContent editor={editor} />
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {wordCount} mot{wordCount > 1 ? 's' : ''}
            {isOverLimit && (
              <span className="text-destructive ml-2">
                ⚠️ Limite dépassée de {wordCount - wordLimit!} mots
              </span>
            )}
          </div>

          <Button onClick={() => saveContent()} disabled={saving || isOverLimit}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Sauvegarde...' : 'Sauvegarder'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}