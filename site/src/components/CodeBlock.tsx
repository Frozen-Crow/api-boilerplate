import { useEffect, useRef } from 'react'
import hljs from 'highlight.js/lib/core'
import typescript from 'highlight.js/lib/languages/typescript'
import bash from 'highlight.js/lib/languages/bash'

hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('ts', typescript)
hljs.registerLanguage('bash', bash)

const COLORS = ['#ff5f57', '#febc2e', '#28c840']

export function CodeBlock({
  code,
  language = 'typescript',
  file
}: {
  code: string
  language?: string
  file?: string
}) {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.removeAttribute('data-highlighted')
      hljs.highlightElement(ref.current)
    }
  }, [code, language])

  return (
    <div className="code-window">
      <div className="code-head">
        {COLORS.map((c) => (
          <span key={c} className="code-dot" style={{ background: c }} />
        ))}
        {file && <span className="code-file">{file}</span>}
      </div>
      <pre>
        <code ref={ref} className={`language-${language}`}>
          {code.trim()}
        </code>
      </pre>
    </div>
  )
}
