import ReactMarkdown from "react-markdown"
import rehypeRaw from "rehype-raw"
import rehypeSanitize from "rehype-sanitize"
import remarkGfm from "remark-gfm"

/** Rend le contenu d’une section (HTML de l’éditeur ou Markdown) après assainissement. */
export function ReportContent({ children }: { children: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize]}>
      {children}
    </ReactMarkdown>
  )
}
