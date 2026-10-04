import type { Ref } from 'react'
import { COPY } from '../copy'
import type { OutlineItem } from '../types'

interface OutlinePanelProps {
  outline: OutlineItem[]
  activeId: string
  /** Kept mounted and slid in and out, like the shelf. */
  open: boolean
  onJump: (id: string) => void
  /** The panel itself: the pane watches presses outside it. */
  ref?: Ref<HTMLElement>
}

export function OutlinePanel({ outline, activeId, open, onJump, ref }: OutlinePanelProps) {
  return (
    <aside className="outline" data-open={open} ref={ref}>
      <p className="outline-head">{COPY.outlineTitle}</p>
      <nav aria-label={COPY.outlineTitle}>
        {outline.map((item) => (
          <button
            key={item.id}
            className="outline-item"
            type="button"
            data-level={item.level}
            aria-current={item.id === activeId ? 'true' : undefined}
            title={item.text}
            onClick={() => onJump(item.id)}
          >
            {item.text}
          </button>
        ))}
      </nav>
    </aside>
  )
}
