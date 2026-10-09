import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { LuColumns2, LuExternalLink, LuListTree, LuRows2, LuX, LuZap } from 'react-icons/lu'
import { COPY } from '../copy'
import { LANGS, MAX_PANES, PREFERS_REDUCED_MOTION } from '../lib/config'
import { viewKey } from '../lib/docs'
import { useViewerStore } from '../lib/store'
import { useAdhdDocument, useChapterDocument, usePdfDocument } from '../hooks/useChapterDocument'
import { useScrollSpy } from '../hooks/useScrollSpy'
import { AdhdPanel } from './AdhdPanel'
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
  canSplit,
  canClose,
  onLangChange,
  onSplit,
  onClose,
}: PaneProps) {
  const doc = useChapterDocument(chapter, lang, paneId)
  const adhd = useAdhdDocument(chapter, paneId)
  const pdf = usePdfDocument(chapter)
  const [outlineOpen, setOutlineOpen] = useState(false)
  const [adhdOpen, setAdhdOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const docRef = useRef<HTMLElement>(null)
  const mainRef = useRef<HTMLDivElement>(null)
  const outlineRef = useRef<HTMLElement>(null)

  const isPdf = lang === 'pdf'
  const pdfSource = chapter?.sources.pdf
  const markdownSource = isPdf ? undefined : chapter?.sources[lang]
  const key = chapter ? viewKey(paneId, chapter.id, lang) : lang
  const canOutline = !isPdf && doc.outline.length > 1
  const showOutline = outlineOpen && doc.status === 'ready' && canOutline
  // The condensed rendition belongs to the chapter, not to this pane's language,
  // so it is available for the PDF original too and keys off the chapter alone.
  const adhdKey = chapter ? viewKey(paneId, chapter.id, 'adhd') : 'adhd'
  const canAdhd = Boolean(chapter?.adhd)
  const ids = useMemo(() => doc.outline.map((item) => item.id), [doc.outline])
  const activeId = useScrollSpy({ scrollRef, docRef, ids, enabled: showOutline })

  useEffect(() => {
    if (isPdf) setOutlineOpen(false)
  }, [isPdf])

  // Pressing the text puts the outline away, the same way the shelf behaves. The
  // listener sits on `.pane-main`, so the ☰ button in the header keeps its own
  // toggle, and each pane only ever closes its own outline.
  useEffect(() => {
    const main = mainRef.current
    if (!showOutline || !main) return
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && outlineRef.current?.contains(event.target)) return
      setOutlineOpen(false)
    }
    main.addEventListener('pointerdown', onPointerDown)
    return () => main.removeEventListener('pointerdown', onPointerDown)
  }, [showOutline])

  // Remember where this pane/chapter/language was left, and restore it on return.
  const lastOffset = useRef({ key: '', top: 0 })
  const rememberScroll = useViewerStore((state) => state.rememberScroll)

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return
    // Read imperatively: scrolling must not re-render every pane.
    element.scrollTop = useViewerStore.getState().scroll[key] ?? 0
  }, [key, doc.html])

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return
    const remember = () => {
      lastOffset.current = { key, top: element.scrollTop }
      rememberScroll(key, element.scrollTop)
    }
    element.addEventListener('scroll', remember, { passive: true })
    return () => {
      element.removeEventListener('scroll', remember)
      // A switch can land in the same frame as a scroll, before the event fires —
      // but only this key's own offset may be written.
      if (lastOffset.current.key === key) rememberScroll(key, lastOffset.current.top)
    }
  }, [key, rememberScroll])

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
      if (!pdfSource) return <Notice title={COPY.missingSource('pdf')} sub={suggestion} />
      if (pdf.detail) return <Notice title={COPY.loadFailedTitle} sub={pdf.detail} />
      if (!pdf.url) return <p className="doc-loading">{COPY.loading}</p>
      return <PdfFrame path={pdf.url} />
    }
    if (doc.status === 'loading' || doc.status === 'idle') {
      return <p className="doc-loading">{COPY.loading}</p>
    }
    if (doc.status === 'missing') return <Notice title={COPY.missingSource(lang)} sub={suggestion} />
    if (doc.status === 'error') {
      return (
        <Notice
          title={COPY.loadFailedTitle}
          sub={COPY.loadFailedSub(markdownSource?.name ?? key, doc.detail)}
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
          {isPdf && pdf.url ? (
            <a
              className="tool-link"
              href={pdf.url}
              target="_blank"
              rel="noreferrer"
              title={COPY.openPdfTitle}
            >
              {COPY.openPdf}
              <LuExternalLink />
            </a>
          ) : null}
          <button
            className="tool-btn icon-btn"
            type="button"
            aria-pressed={outlineOpen}
            aria-label={COPY.outlineToggleTitle}
            hidden={!canOutline}
            title={COPY.outlineToggleTitle}
            onClick={() => setOutlineOpen((open) => !open)}
          >
            <LuListTree />
          </button>
          <button
            className="tool-btn icon-btn"
            type="button"
            aria-pressed={adhdOpen}
            disabled={!canAdhd}
            aria-label={COPY.adhdToggleTitle}
            title={canAdhd ? COPY.adhdToggleTitle : COPY.adhdMissing}
            onClick={() => setAdhdOpen((open) => !open)}
          >
            <LuZap />
          </button>
          <button
            className="tool-btn icon-btn"
            type="button"
            disabled={!canSplit}
            title={canSplit ? COPY.splitRightTitle : COPY.paneLimitTitle(MAX_PANES)}
            aria-label={COPY.splitRightTitle}
            onClick={() => onSplit('row')}
          >
            <LuColumns2 />
          </button>
          <button
            className="tool-btn icon-btn"
            type="button"
            disabled={!canSplit}
            title={canSplit ? COPY.splitDownTitle : COPY.paneLimitTitle(MAX_PANES)}
            aria-label={COPY.splitDownTitle}
            onClick={() => onSplit('col')}
          >
            <LuRows2 />
          </button>
          <button
            className="tool-btn icon-btn"
            type="button"
            hidden={!canClose}
            title={COPY.closePaneTitle}
            aria-label={COPY.closePaneTitle}
            onClick={onClose}
          >
            <LuX />
          </button>
        </div>
      </header>
      <div className="pane-main" ref={mainRef}>
        <div className="pane-scroll" ref={scrollRef}>
          {renderBody()}
        </div>
        {/* Kept mounted while available, so opening it slides rather than pops. */}
        {canOutline ? (
          <OutlinePanel
            ref={outlineRef}
            outline={doc.outline}
            activeId={activeId}
            open={showOutline}
            onJump={jump}
          />
        ) : null}
        {/* Mounted while the chapter has one, so opening it slides rather than pops. */}
        {canAdhd ? (
          <AdhdPanel doc={adhd} open={adhdOpen} docKey={adhdKey} />
        ) : null}
      </div>
    </section>
  )
}
