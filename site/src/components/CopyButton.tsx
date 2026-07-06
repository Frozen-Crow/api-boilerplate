import { useState } from 'react'

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <button className="copy-btn" onClick={copy} aria-label="Copy to clipboard">
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  )
}
