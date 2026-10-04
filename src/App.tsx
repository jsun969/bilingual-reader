import { useCallback, useEffect, useState } from 'react'
import { COPY } from './copy'
import { DESKTOP_QUERY } from './lib/config'
import { findChapter } from './lib/catalog'
import { closePane, countPanes, setPaneLang, setSplitRatio, splitPane } from './lib/layout'
import { useCatalog } from './hooks/useCatalog'
import { useMediaQuery } from './hooks/useMediaQuery'
import { useViewState } from './hooks/useViewState'
import { ChapterShelf } from './components/ChapterShelf'
import { FatalScreen } from './components/FatalScreen'
import { LayoutView } from './components/LayoutView'
import { TopBar } from './components/TopBar'
import type { Chapter, Lang, SplitDir } from './types'

/** A new window opens on the other reading language when the chapter has one. */
function nextLangFor(chapter: Chapter | undefined, from: Lang): Lang {
  const other: Lang = from === 'zh' ? 'en' : 'zh'
  if (chapter?.sources[other]) return other
  return from
}

export function App() {
  const { catalog, status, detail } = useCatalog()
  const [view, updateView] = useViewState()
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  const [navOpen, setNavOpen] = useState(() => window.matchMedia(DESKTOP_QUERY).matches)

  const chapters = catalog.chapters
  const chapter = findChapter(chapters, view.chapter)
  const paneCount = countPanes(view.layout)

  // A stale chapter (first run, or a chapter that moved) falls back to the first one.
  useEffect(() => {
    if (status !== 'ready' || chapters.length === 0) return
    if (chapters.some((candidate) => candidate.slug === view.chapter)) return
    updateView({ chapter: chapters[0].slug })
  }, [status, chapters, view.chapter, updateView])

  useEffect(() => {
    document.title = chapter
      ? `${chapter.num ? `${Number(chapter.num)}. ` : ''}${chapter.title} · ${COPY.appName}`
      : COPY.appName
  }, [chapter])

  const selectChapter = useCallback(
    (slug: string) => {
      updateView({ chapter: slug })
      if (!window.matchMedia(DESKTOP_QUERY).matches) setNavOpen(false)
    },
    [updateView],
  )

  const changeLang = useCallback(
    (paneId: string, lang: Lang) => {
      updateView((previous) => ({ layout: setPaneLang(previous.layout, paneId, lang) }))
    },
    [updateView],
  )

  const addPane = useCallback(
    (paneId: string, dir: SplitDir, lang: Lang) => {
      updateView((previous) => ({
        layout: splitPane(previous.layout, paneId, dir, nextLangFor(chapter, lang)),
      }))
    },
    [chapter, updateView],
  )

  const removePane = useCallback(
    (paneId: string) => {
      updateView((previous) => {
        const layout = closePane(previous.layout, paneId)
        return layout ? { layout } : {}
      })
    },
    [updateView],
  )

  const resizeSplit = useCallback(
    (splitId: string, ratio: number) => {
      updateView((previous) => ({ layout: setSplitRatio(previous.layout, splitId, ratio) }))
    },
    [updateView],
  )

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
      data-split={paneCount > 1 ? 'true' : 'false'}
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
        <LayoutView
          root={view.layout}
          chapter={chapter}
          paneCount={paneCount}
          onLangChange={changeLang}
          onSplit={addPane}
          onClose={removePane}
          onRatio={resizeSplit}
        />
      </div>
    </div>
  )
}
