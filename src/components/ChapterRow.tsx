import { LuPencil, LuTrash2 } from 'react-icons/lu'
import { COPY } from '../copy'
import type { Chapter, ChapterStatus } from '../types'

interface ChapterRowProps {
  chapter: Chapter
  current: boolean
  onSelect: (id: string) => void
  onRename: (id: string) => void
  onRemove: (id: string) => void
}

/** What the row says instead of a reading time while its folder is unusable. */
const STATUS: Partial<Record<ChapterStatus, { label: string; title: string }>> = {
  loading: { label: COPY.statusLoading, title: '' },
  'needs-permission': { label: COPY.statusPermission, title: COPY.statusPermissionTitle },
  missing: { label: COPY.statusMissing, title: COPY.statusMissingTitle },
}

export function ChapterRow({ chapter, current, onSelect, onRename, onRemove }: ChapterRowProps) {
  const minutes = chapter.sources.zh?.minutes ?? chapter.sources.en?.minutes
  const missing = (['zh', 'en'] as const).filter((lang) => !chapter.sources[lang])
  const status = STATUS[chapter.status]
  const label = /^\d+$/.test(chapter.num) ? chapter.num.padStart(2, '0') : chapter.num

  return (
    <div className="chapter" aria-current={current ? 'true' : 'false'}>
      <button className="chapter-main" type="button" onClick={() => onSelect(chapter.id)}>
        <span className="chapter-num">{label || '··'}</span>
        <span className="chapter-name">{chapter.title}</span>
        {status ? (
          <span className="chapter-meta is-gap" title={status.title}>
            {status.label}
          </span>
        ) : missing.length > 0 ? (
          <span
            className="chapter-meta is-gap"
            title={COPY.missingMarkTitle(missing.map(COPY.langLabel))}
          >
            {COPY.missingMark(missing.map(COPY.langLabel))}
          </span>
        ) : (
          <span className="chapter-meta" title={minutes ? COPY.minutesTitle(minutes) : undefined}>
            {minutes ? COPY.minutes(minutes) : ''}
          </span>
        )}
      </button>
      <span className="chapter-acts">
        <button
          className="chapter-act"
          type="button"
          title={COPY.renameChapter}
          aria-label={COPY.renameChapter}
          onClick={() => onRename(chapter.id)}
        >
          <LuPencil />
        </button>
        <button
          className="chapter-act"
          type="button"
          title={COPY.removeChapter}
          aria-label={COPY.removeChapter}
          onClick={() => onRemove(chapter.id)}
        >
          <LuTrash2 />
        </button>
      </span>
    </div>
  )
}
