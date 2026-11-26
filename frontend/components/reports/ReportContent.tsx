import ReactMarkdown from "react-markdown"
import rehypeRaw from "rehype-raw"
import rehypeSanitize from "rehype-sanitize"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"

/**
 * Mise en forme du texte d’une section, identique dans l’éditeur et à la lecture
 * (titres, listes, citations et code ne sont pas stylés par défaut dans Tailwind).
 */
export const RICH_TEXT_CLASS = cn(
  "break-words text-[15px] leading-7 text-foreground",
  "[&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
  "[&_h1]:mb-2 [&_h1]:mt-6 [&_h1]:text-xl [&_h1]:font-semibold [&_h1]:leading-snug",
  "[&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:leading-snug",
  "[&_h3]:mb-1.5 [&_h3]:mt-5 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:leading-snug",
  "[&_p]:my-3",
  "[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6",
  "[&_li]:my-1 [&_li>p]:my-0",
  "[&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground",
  "[&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:font-mono [&_pre]:text-sm [&_pre]:leading-6",
  "[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.9em]",
  "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
  "[&_a]:text-primary [&_a]:underline",
  "[&_table]:my-4 [&_table]:w-full [&_td]:border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left",
  "[&_hr]:my-6",
)

/** Rend le contenu d’une section (HTML de l’éditeur ou Markdown) après assainissement. */
export function ReportContent({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn(RICH_TEXT_CLASS, className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize]}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
