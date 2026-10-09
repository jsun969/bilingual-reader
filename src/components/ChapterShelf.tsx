import type { Ref } from 'react'
import { LuFolderPlus } from 'react-icons/lu'
import { COPY } from '../copy'
import { pickerSupported } from '../lib/fs'
import { ChapterRow } from './ChapterRow'
import type { Chapter } from '../types'

interface ChapterShelfProps {
  chapters: Chapter[]
  /** The stored folders are still being checked against the disk. */
  restoring: boolean
  current: string | undefined
  onSelect: (id: string) => void
  onRename: (id: string) => void
  onRemove: (id: string) => void
  onImport: () => void
  /** The floating panel itself: the workspace watches presses outside it. */
  ref?: Ref<HTMLElement>
}

export function ChapterShelf({
  chapters,
  restoring,
  current,
  onSelect,
  onRename,
  onRemove,
  onImport,
  ref,
}: ChapterShelfProps) {
  const supported = pickerSupported()

  return (
    <aside className="shelf grid-bg" ref={ref}>
      <div className="shelf-head">
        <p className="shelf-title">{COPY.shelfTitle}</p>
        <p className="shelf-meta">
          {restoring ? COPY.shelfReading : COPY.shelfCount(chapters.length)}
        </p>
      </div>
      <nav className="chapters" aria-label={COPY.shelfTitle}>
        {chapters.map((chapter) => (
          <ChapterRow
            key={chapter.id}
            chapter={chapter}
            current={chapter.id === current}
            onSelect={onSelect}
            onRename={onRename}
            onRemove={onRemove}
          />
        ))}
      </nav>
      <div className="shelf-foot">
        <button
          className="shelf-import"
          type="button"
          disabled={!supported}
          title={supported ? COPY.importTitle : COPY.unsupportedTitle}
          onClick={onImport}
        >
          <LuFolderPlus />
          {COPY.importLabel}
        </button>
      </div>
    </aside>
  )
}
