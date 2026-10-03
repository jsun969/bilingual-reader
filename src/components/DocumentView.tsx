import type { RefObject } from 'react'

interface DocumentViewProps {
  html: string
  docKey: string
  docRef: RefObject<HTMLElement | null>
}

/**
 * The rendered chapter. Remounting on `docKey` replays the pane's entry
 * animation and drops the previous document's DOM in one step.
 */
export function DocumentView({ html, docKey, docRef }: DocumentViewProps) {
  return (
    <article
      className="doc"
      key={docKey}
      ref={docRef}
      tabIndex={0}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
