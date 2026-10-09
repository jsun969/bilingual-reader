import { useEffect, useRef, useState } from 'react'
import { COPY } from './copy'
import { findChapter } from './lib/docs'
import { countPanes } from './lib/layout'
import { useLibraryStore } from './lib/library'
import { useViewerStore } from './lib/store'
import { ChapterShelf } from './components/ChapterShelf'
import { ImportDialog } from './components/ImportDialog'
import type { DialogState } from './components/ImportDialog'
import { LayoutView } from './components/LayoutView'
import { TopBar } from './components/TopBar'

export function App() {
  const chapters = useLibraryStore((state) => state.chapters)
  const restoring = useLibraryStore((state) => state.restoring)
  const restore = useLibraryStore((state) => state.restore)
  const makeReady = useLibraryStore((state) => state.makeReady)
  const removeChapter = useLibraryStore((state) => state.removeChapter)

  const chapterId = useViewerStore((state) => state.chapter)
  const layout = useViewerStore((state) => state.layout)
  const openChapter = useViewerStore((state) => state.openChapter)

  // Closed by default: the shelf floats over the text now, so it only appears
  // when asked for — except on an empty shelf, where the import button lives.
  const [navOpen, setNavOpen] = useState(false)
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const workspaceRef = useRef<HTMLDivElement>(null)
  const shelfRef = useRef<HTMLElement>(null)

  const chapter = findChapter(chapters, chapterId)
  const shelfOpen = navOpen || (chapters.length === 0 && !restoring)
  const multiPane = countPanes(layout) > 1

  // Once per load: check every stored folder handle against the disk.
  useEffect(() => {
    void restore()
  }, [restore])

  // Pressing anywhere but the shelf itself puts it away. The listener sits on the
  // workspace, so the top bar's 目录 button, which is outside this element, keeps
  // its own toggle, and the wheel over the text still scrolls the text.
  useEffect(() => {
    const workspace = workspaceRef.current
    if (!shelfOpen || !workspace) return
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && shelfRef.current?.contains(event.target)) return
      setNavOpen(false)
    }
    workspace.addEventListener('pointerdown', onPointerDown)
    return () => workspace.removeEventListener('pointerdown', onPointerDown)
  }, [shelfOpen])

  // A chapter that is no longer on the shelf (first run, or one just removed)
  // falls back to the first readable one, then to the first one at all.
  useEffect(() => {
    if (restoring || chapters.length === 0) return
    if (chapters.some((candidate) => candidate.id === chapterId)) return
    const fallback = chapters.find((candidate) => candidate.status === 'ready') ?? chapters[0]
    openChapter(fallback.id)
  }, [restoring, chapters, chapterId, openChapter])

  useEffect(() => {
    document.title = chapter
      ? `${chapter.num ? `${chapter.num}. ` : ''}${chapter.title} · ${COPY.appName}`
      : COPY.appName
  }, [chapter])

  // The shelf floats over the text, so picking a chapter puts it away again —
  // after making sure its folder is actually readable.
  const selectChapter = async (id: string) => {
    const result = await makeReady(id)
    if (result === 'relink') setDialog({ mode: 'relink', id })
    else if (result === 'ready') openChapter(id)
    setNavOpen(false)
  }

  const remove = async (id: string) => {
    const target = chapters.find((candidate) => candidate.id === id)
    if (!target || !window.confirm(COPY.removeConfirm(target.title))) return
    await removeChapter(id)
  }

  const dialogChapter =
    dialog && dialog.mode !== 'import' ? chapters.find((c) => c.id === dialog.id) : undefined

  return (
    <div
      className="app"
      data-split={multiPane ? 'true' : 'false'}
      data-nav={shelfOpen ? 'open' : 'closed'}
    >
      <TopBar
        chapter={chapter}
        navOpen={shelfOpen}
        onToggleNav={() => setNavOpen((open) => !open)}
      />
      <div className="workspace" ref={workspaceRef}>
        <ChapterShelf
          ref={shelfRef}
          chapters={chapters}
          restoring={restoring}
          current={chapter?.id}
          onSelect={(id) => void selectChapter(id)}
          onRename={(id) => setDialog({ mode: 'rename', id })}
          onRemove={(id) => void remove(id)}
          onImport={() => setDialog({ mode: 'import' })}
        />
        {shelfOpen ? <div className="scrim" /> : null}
        <LayoutView root={layout} chapter={chapter} />
      </div>
      {dialog ? (
        <ImportDialog
          mode={dialog.mode}
          chapter={dialogChapter}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </div>
  )
}
