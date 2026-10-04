import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { COPY } from '../copy'
import { LANGS, MAX_PANES, PREFERS_REDUCED_MOTION } from '../lib/config'
import { scrollMemory, viewKey } from '../lib/catalog'
import { useChapterDocument } from '../hooks/useChapterDocument'
import { useScrollSpy } from '../hooks/useScrollSpy'
import { DocumentView } from './DocumentView'
import { LanguageSwitch } from './LanguageSwitch'
import { Notice } from './Notice'
import { OutlinePanel } from './OutlinePanel'
import { PdfFrame } from './PdfFrame'
import type { Chapter, Lang, SplitDir } from '../types'

interface PaneProps {
  /** Stable window id: keys this pane's caches and prefixes its document ids. */
  paneId: string
  chapter: Chapter | undefined
  lang: Lang
  /** This is the only window open, so there is room for the outline beside it. */
  single: boolean
  canSplit: boolean
  canClose: boolean
  onLangChange: (lang: Lang) => void
  onSplit: (dir: SplitDir) => void
  onClose: () => void
}

export function Pane({
  paneId,
  chapter,
  lang,
  single,
  canSplit,
  canClose,
  onLangChange,
  onSplit,
  onClose,
}: PaneProps) {
  const doc = useChapterDocument(chapter, lang, paneId)
  const [outlineOpen, setOutlineOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const docRef = useRef<HTMLElement>(null)

  const isPdf = lang === 'pdf'
  const pdfSource = chapter?.sources.pdf
  const markdownSource = isPdf ? undefined : chapter?.sources[lang]
  const key = chapter ? viewKey(paneId, chapter.slug, lang) : lang
  const canOutline = !isPdf && single && doc.outline.length > 1
  const showOutline = outlineOpen && doc.status === 'ready' && canOutline
  const ids = useMemo(() => doc.outline.map((item) => item.id), [doc.outline])
  const activeId = useScrollSpy({ scrollRef, docRef, ids, enabled: showOutline })

  useEffect(() => {
    if (isPdf || !single) setOutlineOpen(false)
  }, [isPdf, single])

  // Remember where this pane/chapter/language was left, and restore it on return.
  const lastOffset = useRef(0)

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return
    element.scrollTop = scrollMemory.get(key) ?? 0
  }, [key, doc.html])

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return
    const remember = () => {
      lastOffset.current = element.scrollTop
      scrollMemory.set(key, element.scrollTop)
    }
    element.addEventListener('scroll', remember, { passive: true })
    return () => {
      element.removeEventListener('scroll', remember)
      // A switch can land in the same frame as a scroll, before the event fires.
      scrollMemory.set(key, lastOffset.current)
    }
  }, [key])

  const jump = useCallback((id: string) => {
    const scroll = scrollRef.current
    const root = docRef.current
    if (!scroll || !root) return
    const heading = root.querySelector<HTMLElement>(`#${CSS.escape(id)}`)
    if (!heading) return
    scroll.scrollTo({
      top: heading.offsetTop + root.offsetTop - 12,
      behavior: PREFERS_REDUCED_MOTION ? 'auto' : 'smooth',
    })
  }, [])

  const suggestion = COPY.missingSuggestion(
    chapter
      ? LANGS.filter((candidate) => Boolean(chapter.sources[candidate])).map((candidate) =>
          COPY.langLabel(candidate),
        )
      : [],
  )

  const renderBody = (): ReactNode => {
    if (!chapter) return <Notice title={COPY.noChapterTitle} sub={COPY.noChapterSub} />
    if (isPdf) {
      return pdfSource ? (
        <PdfFrame path={pdfSource.path} />
      ) : (
        <Notice title={COPY.missingSource('pdf')} sub={suggestion} />
      )
    }
    if (doc.status === 'loading' || doc.status === 'idle') {
      return <p className="doc-loading">{COPY.loading}</p>
    }
    if (doc.status === 'missing') return <Notice title={COPY.missingSource(lang)} sub={suggestion} />
    if (doc.status === 'error') {
      return (
        <Notice
          title={COPY.loadFailedTitle}
          sub={COPY.loadFailedSub(markdownSource?.path ?? key, doc.detail)}
        />
      )
    }
    return <DocumentView html={doc.html} docKey={key} docRef={docRef} />
  }

  return (
    <section className="pane" data-lang={lang}>
      <header className="pane-top" key={key}>
        <LanguageSwitch current={lang} sources={chapter?.sources} onChange={onLangChange} />
        <div className="pane-tools">
          {isPdf && pdfSource ? (
            <a
              className="tool-link"
              href={pdfSource.path}
              target="_blank"
              rel="noreferrer"
              title={COPY.openPdfTitle}
            >
              {COPY.openPdf}
            </a>
          ) : null}
          <button
            className="tool-btn"
            type="button"
            aria-pressed={outlineOpen}
            hidden={!canOutline}
            title={COPY.outlineToggleTitle}
            onClick={() => setOutlineOpen((open) => !open)}
          >
            {COPY.outlineToggle}
          </button>
          <button
            className="tool-btn win-btn"
            type="button"
            disabled={!canSplit}
            title={canSplit ? COPY.splitRightTitle : COPY.paneLimitTitle(MAX_PANES)}
            aria-label={COPY.splitRightTitle}
            onClick={() => onSplit('row')}
          >
            {COPY.splitRight}
          </button>
          <button
            className="tool-btn win-btn"
            type="button"
            disabled={!canSplit}
            title={canSplit ? COPY.splitDownTitle : COPY.paneLimitTitle(MAX_PANES)}
            aria-label={COPY.splitDownTitle}
            onClick={() => onSplit('col')}
          >
            {COPY.splitDown}
          </button>
          <button
            className="tool-btn win-btn"
            type="button"
            hidden={!canClose}
            title={COPY.closePaneTitle}
            aria-label={COPY.closePaneTitle}
            onClick={onClose}
          >
            {COPY.closePane}
          </button>
        </div>
      </header>
      <div className="pane-main">
        <div className="pane-scroll" ref={scrollRef}>
          {renderBody()}
        </div>
        {showOutline ? (
          <OutlinePanel outline={doc.outline} activeId={activeId} onJump={jump} />
        ) : null}
      </div>
    </section>
  )
}
