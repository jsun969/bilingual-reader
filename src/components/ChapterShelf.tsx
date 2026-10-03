import { COPY } from '../copy'
import { ChapterRow } from './ChapterRow'
import type { Catalog } from '../types'

interface ChapterShelfProps {
  catalog: Catalog
  status: 'loading' | 'ready' | 'error'
  current: string | undefined
  onSelect: (slug: string) => void
}

export function ChapterShelf({ catalog, status, current, onSelect }: ChapterShelfProps) {
  return (
    <aside className="shelf grid-bg">
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
