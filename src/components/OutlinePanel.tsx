import { COPY } from '../copy'
import type { OutlineItem } from '../types'

interface OutlinePanelProps {
  outline: OutlineItem[]
  activeId: string
  onJump: (id: string) => void
}

export function OutlinePanel({ outline, activeId, onJump }: OutlinePanelProps) {
  return (
    <aside className="outline">
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
