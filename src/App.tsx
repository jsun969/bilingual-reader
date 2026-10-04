import { useEffect, useState } from 'react'
import { COPY } from './copy'
import { DESKTOP_QUERY } from './lib/config'
import { findChapter } from './lib/catalog'
import { countPanes } from './lib/layout'
import { useViewerStore } from './lib/store'
import { useCatalog } from './hooks/useCatalog'
import { useMediaQuery } from './hooks/useMediaQuery'
import { ChapterShelf } from './components/ChapterShelf'
import { FatalScreen } from './components/FatalScreen'
import { LayoutView } from './components/LayoutView'
import { TopBar } from './components/TopBar'

export function App() {
  const { catalog, status, detail } = useCatalog()
  const chapterSlug = useViewerStore((state) => state.chapter)
  const layout = useViewerStore((state) => state.layout)
  const openChapter = useViewerStore((state) => state.openChapter)
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  const [navOpen, setNavOpen] = useState(() => window.matchMedia(DESKTOP_QUERY).matches)

  const chapters = catalog.chapters
  const chapter = findChapter(chapters, chapterSlug)
  const multiPane = countPanes(layout) > 1

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
      <div className="workspace">
        <ChapterShelf
          catalog={catalog}
          status={status}
          current={chapter?.slug}
          onSelect={selectChapter}
        />
        {navOpen && !isDesktop ? <div className="scrim" onClick={() => setNavOpen(false)} /> : null}
        <LayoutView root={layout} chapter={chapter} />
      </div>
    </div>
  )
}
