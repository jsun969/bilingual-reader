import { COPY } from '../copy'
import type { Chapter } from '../types'

interface ChapterRowProps {
  chapter: Chapter
  current: boolean
  onSelect: (slug: string) => void
}

export function ChapterRow({ chapter, current, onSelect }: ChapterRowProps) {
  const minutes = chapter.sources.zh?.minutes ?? chapter.sources.en?.minutes
  const missing = (['zh', 'en'] as const).filter((lang) => !chapter.sources[lang])

  return (
    <button
      className="chapter"
      type="button"
      aria-current={current ? 'true' : 'false'}
      onClick={() => onSelect(chapter.slug)}
    >
      <span className="chapter-num">{chapter.num ? chapter.num.padStart(2, '0') : '··'}</span>
      <span className="chapter-name">{chapter.title}</span>
      {missing.length > 0 ? (
        <span className="chapter-meta is-gap" title={COPY.missingMarkTitle(missing.map(COPY.langLabel))}>
          {COPY.missingMark(missing.map(COPY.langLabel))}
        </span>
      ) : (
        <span className="chapter-meta" title={minutes ? COPY.minutesTitle(minutes) : undefined}>
          {minutes ? COPY.minutes(minutes) : ''}
        </span>
      )}
    </button>
  )
}
