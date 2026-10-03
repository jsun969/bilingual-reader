import { useCallback, useEffect, useState } from 'react'
import { Group, Panel } from 'react-resizable-panels'
import { COPY } from './copy'
import { DESKTOP_QUERY, RATIO_MIN, clampRatio } from './lib/config'
import { findChapter } from './lib/catalog'
import { useCatalog } from './hooks/useCatalog'
import { useMediaQuery } from './hooks/useMediaQuery'
import { useViewState } from './hooks/useViewState'
import { ChapterShelf } from './components/ChapterShelf'
import { FatalScreen } from './components/FatalScreen'
import { Pane } from './components/Pane'
import { SplitHandle } from './components/SplitHandle'
import { TopBar } from './components/TopBar'
import type { Lang, Side } from './types'

const PANEL_MIN = `${RATIO_MIN}%`

export function App() {
  const { catalog, status, detail } = useCatalog()
  const [view, updateView] = useViewState()
  const isDesktop = useMediaQuery(DESKTOP_QUERY)
  const [navOpen, setNavOpen] = useState(() => window.matchMedia(DESKTOP_QUERY).matches)
  // The divider layout is read once; afterwards the library owns it and reports
  // every change back into the persisted view state.
  const [initialLayout] = useState(() => ({
    left: clampRatio(view.ratio),
    right: 100 - clampRatio(view.ratio),
  }))

  const chapters = catalog.chapters
  const chapter = findChapter(chapters, view.chapter)

  // A stale chapter (first run, or a chapter that moved) falls back to the first one.
  useEffect(() => {
    if (status !== 'ready' || chapters.length === 0) return
    if (chapters.some((candidate) => candidate.slug === view.chapter)) return
    updateView({ chapter: chapters[0].slug })
  }, [status, chapters, view.chapter, updateView])

  useEffect(() => {
    document.title = chapter
      ? `${chapter.num ? `${Number(chapter.num)}. ` : ''}${chapter.title} · OSTEP`
      : 'OSTEP 阅读器'
  }, [chapter])

  const selectChapter = useCallback(
    (slug: string) => {
      updateView({ chapter: slug })
      if (!window.matchMedia(DESKTOP_QUERY).matches) setNavOpen(false)
    },
    [updateView],
  )

  const setLang = useCallback(
    (side: Side, lang: Lang) => {
      updateView(side === 'left' ? { left: lang } : { right: lang })
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
    <div className="app" data-split={String(view.split)} data-nav={navOpen ? 'open' : 'closed'}>
      <TopBar
        chapter={chapter}
        navOpen={navOpen}
        split={view.split}
        onToggleNav={() => setNavOpen((open) => !open)}
        onToggleSplit={() => updateView({ split: !view.split })}
      />
      <div className="workspace">
        <ChapterShelf
          catalog={catalog}
          status={status}
          current={chapter?.slug}
          onSelect={selectChapter}
        />
        {navOpen && !isDesktop ? <div className="scrim" onClick={() => setNavOpen(false)} /> : null}
        <Group
          className="split"
          orientation={isDesktop ? 'horizontal' : 'vertical'}
          defaultLayout={initialLayout}
          onLayoutChange={(layout) => {
            if (!view.split || typeof layout.left !== 'number') return
            updateView({ ratio: clampRatio(layout.left) })
          }}
        >
          <Panel className="pane-slot" style={{ overflow: 'hidden' }} minSize={PANEL_MIN} id="left">
            <Pane
              side="left"
              chapter={chapter}
              lang={view.left}
              split={view.split}
              onLangChange={(lang) => setLang('left', lang)}
            />
          </Panel>
          {view.split ? (
            <>
              <SplitHandle percentage={view.ratio} />
              <Panel
                className="pane-slot"
                style={{ overflow: 'hidden' }}
                minSize={PANEL_MIN}
                id="right"
              >
                <Pane
                  side="right"
                  chapter={chapter}
                  lang={view.right}
                  split={view.split}
                  onLangChange={(lang) => setLang('right', lang)}
                />
              </Panel>
            </>
          ) : null}
        </Group>
      </div>
    </div>
  )
}
