import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'
import rehypeHighlight from 'rehype-highlight'
import apiCoreMd from '../content/api-core.md?raw'
import createApiMd from '../content/create-api.md?raw'

const PAGES: Record<string, { label: string; md: string }> = {
  'api-core': { label: '@frozencrow/api-core', md: apiCoreMd },
  'create-api': { label: '@frozencrow/create-api', md: createApiMd }
}

// The in-README "## Contents" list is redundant with our sidebar and its anchor
// links fight the hash router — strip it before rendering.
function stripContents(md: string): string {
  return md.replace(/\n## Contents\n[\s\S]*?(?=\n## )/, '\n')
}

export function Docs() {
  const { page } = useParams()
  const navigate = useNavigate()
  const current = page && PAGES[page] ? page : 'api-core'
  const mdRef = useRef<HTMLDivElement>(null)
  const [headings, setHeadings] = useState<{ id: string; text: string }[]>([])

  const markdown = useMemo(() => stripContents(PAGES[current].md), [current])

  // Build the sidebar from the actually-rendered heading ids so anchors match.
  useEffect(() => {
    if (!mdRef.current) return
    const nodes = Array.from(mdRef.current.querySelectorAll('h2[id]')) as HTMLElement[]
    setHeadings(nodes.map((n) => ({ id: n.id, text: n.textContent || '' })))
  }, [markdown])

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="container docs">
      <aside className="docs-side">
        <div className="docs-tabs">
          {Object.entries(PAGES).map(([key, { label }]) => (
            <div
              key={key}
              className={`docs-tab ${current === key ? 'active' : ''}`}
              onClick={() => navigate(`/docs/${key}`)}
            >
              {label.replace('@frozencrow/', '')}
            </div>
          ))}
        </div>
        <h4>On this page</h4>
        {headings.map((h) => (
          <a
            key={h.id}
            onClick={() => scrollTo(h.id)}
            style={{ cursor: 'pointer' }}
          >
            {h.text}
          </a>
        ))}
      </aside>

      <article className="md" ref={mdRef}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeSlug, rehypeHighlight]}
        >
          {markdown}
        </ReactMarkdown>
      </article>
    </div>
  )
}
