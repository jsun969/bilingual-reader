import type { ReactNode } from 'react'
import { Group, Panel } from 'react-resizable-panels'
import { MAX_PANES, PANEL_MIN } from '../lib/config'
import { countPanes } from '../lib/layout'
import { useViewerStore } from '../lib/store'
import { Pane } from './Pane'
import { SplitHandle } from './SplitHandle'
import type { Chapter, Lang, LayoutNode, SplitNode } from '../types'

interface LayoutViewProps {
  root: LayoutNode
  chapter: Chapter | undefined
}

/** A new window opens on the other reading language when the chapter has one. */
function nextLangFor(chapter: Chapter | undefined, from: Lang): Lang {
  const other: Lang = from === 'zh' ? 'en' : 'zh'
  if (chapter?.sources[other]) return other
  return from
}

/**
 * The window tree, rendered as nested resizable groups: a split is one `Group`,
 * each of its sides is a `Panel` holding either a pane or the next group. Every
 * window button and divider goes straight to the store.
 */
export function LayoutView({ root, chapter }: LayoutViewProps) {
  const addPane = useViewerStore((state) => state.addPane)
  const removePane = useViewerStore((state) => state.removePane)
  const changeLang = useViewerStore((state) => state.changeLang)
  const resizeSplit = useViewerStore((state) => state.resizeSplit)
  const paneCount = countPanes(root)

  const slot = (node: LayoutNode): ReactNode => (
    <Panel id={node.id} className="pane-slot" minSize={PANEL_MIN} style={{ overflow: 'hidden' }}>
      {node.kind === 'split' ? (
        group(node)
      ) : (
        <Pane
          paneId={node.id}
          chapter={chapter}
          lang={node.lang}
          single={paneCount === 1}
          canSplit={paneCount < MAX_PANES}
          canClose={paneCount > 1}
          onLangChange={(lang) => changeLang(node.id, lang)}
          onSplit={(dir) => addPane(node.id, dir, nextLangFor(chapter, node.lang))}
          onClose={() => removePane(node.id)}
        />
      )}
    </Panel>
  )

  const group = (node: SplitNode): ReactNode => (
    <Group
      className={`split split-${node.dir}`}
      orientation={node.dir === 'row' ? 'horizontal' : 'vertical'}
      defaultLayout={{ [node.first.id]: node.ratio, [node.second.id]: 100 - node.ratio }}
      onLayoutChange={(layout) => {
        const ratio = layout[node.first.id]
        if (typeof ratio === 'number') resizeSplit(node.id, ratio)
      }}
    >
      {slot(node.first)}
      <SplitHandle ratio={node.ratio} />
      {slot(node.second)}
    </Group>
  )

  if (root.kind === 'pane') return <Group className="split">{slot(root)}</Group>
  return group(root)
}
