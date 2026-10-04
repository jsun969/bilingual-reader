import { useEffect, useRef, useState } from 'react'
import { COPY } from './copy'
import { DESKTOP_QUERY } from './lib/config'
import { findChapter } from './lib/catalog'
import { countPanes } from './lib/layout'
import { useViewerStore } from './lib/store'
import { useCatalog } from './hooks/useCatalog'
import { ChapterShelf } from './components/ChapterShelf'
import { FatalScreen } from './components/FatalScreen'
import { LayoutView } from './components/LayoutView'
import { TopBar } from './components/TopBar'

export function App() {
  const { catalog, status, detail } = useCatalog()
  const chapterSlug = useViewerStore((state) => state.chapter)
  const layout = useViewerStore((state) => state.layout)
  const openChapter = useViewerStore((state) => state.openChapter)
  const [navOpen, setNavOpen] = useState(() => window.matchMedia(DESKTOP_QUERY).matches)
  const workspaceRef = useRef<HTMLDivElement>(null)
  const shelfRef = useRef<HTMLElement>(null)

  const chapters = catalog.chapters
  const chapter = findChapter(chapters, chapterSlug)
  const multiPane = countPanes(layout) > 1

  // Pressing anywhere but the shelf itself puts it away. The listener sits on the
  // workspace, so the top bar's 目录 button — outside this element — keeps its own
  // toggle, and the wheel over the text still scrolls the text.
  useEffect(() => {
    const workspace = workspaceRef.current
    if (!navOpen || !workspace) return
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && shelfRef.current?.contains(event.target)) return
      setNavOpen(false)
    }
    workspace.addEventListener('pointerdown', onPointerDown)
    return () => workspace.removeEventListener('pointerdown', onPointerDown)
  }, [navOpen])

  // A stale chapter (first run, or a chapter that moved) falls back to the first one.
  useEffect(() => {
    if (status !== 'ready' || chapters.length === 0) return
    if (chapters.some((candidate) => candidate.slug === chapterSlug)) return
    openChapter(chapters[0].slug)
  }, [status, chapters, chapterSlug, openChapter])

  useEffect(() => {
    document.title = chapter
      ? `${chapter.num ? `${Number(chapter.num)}. ` : ''}${chapter.title} · ${COPY.appName}`
      : COPY.appName
  }, [chapter])

  // The shelf floats over the text, so picking a chapter puts it away again.
  const selectChapter = (slug: string) => {
    openChapter(slug)
    setNavOpen(false)
  }

  if (status === 'error') {
    return (
      <FatalScreen
        title={COPY.catalogFailedTitle}
        sub={COPY.catalogFailedSub(catalog.assetDir)}
        detail={COPY.catalogFailedDetail(detail)}
      />
    )
  }

  if (status === 'ready' && chapters.length === 0) {
    return (
      <FatalScreen
        title={COPY.catalogEmptyTitle(catalog.assetDir)}
        sub={COPY.catalogEmptySub}
        detail={COPY.catalogEmptyDetail(catalog.assetDir)}
      />
    )
  }

  return (
    <div
      className="app"
      data-split={multiPane ? 'true' : 'false'}
      data-nav={navOpen ? 'open' : 'closed'}
    >
      <TopBar
        chapter={chapter}
        navOpen={navOpen}
        onToggleNav={() => setNavOpen((open) => !open)}
      />
      <div className="workspace" ref={workspaceRef}>
        <ChapterShelf
          ref={shelfRef}
          catalog={catalog}
          status={status}
          current={chapter?.slug}
          onSelect={selectChapter}
        />
        {navOpen ? <div className="scrim" /> : null}
        <LayoutView root={layout} chapter={chapter} />
      </div>
    </div>
  )
}
