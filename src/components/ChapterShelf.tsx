import type { Ref } from 'react'
import { COPY } from '../copy'
import { ChapterRow } from './ChapterRow'
import type { Catalog } from '../types'

interface ChapterShelfProps {
  catalog: Catalog
  status: 'loading' | 'ready' | 'error'
  current: string | undefined
  onSelect: (slug: string) => void
  /** The floating panel itself: the workspace watches presses outside it. */
  ref?: Ref<HTMLElement>
}

export function ChapterShelf({ catalog, status, current, onSelect, ref }: ChapterShelfProps) {
  return (
    <aside className="shelf grid-bg" ref={ref}>
      <div className="shelf-head">
        <p className="shelf-title">{COPY.shelfTitle}</p>
        <p className="shelf-meta">
          {status === 'ready'
            ? COPY.shelfCount(catalog.assetDir, catalog.chapters.length)
            : COPY.shelfScanning(catalog.assetDir)}
        </p>
      </div>
      <nav className="chapters" aria-label={COPY.shelfTitle}>
        {catalog.chapters.map((chapter) => (
          <ChapterRow
            key={chapter.slug}
            chapter={chapter}
            current={chapter.slug === current}
            onSelect={onSelect}
          />
        ))}
      </nav>
    </aside>
  )
}
