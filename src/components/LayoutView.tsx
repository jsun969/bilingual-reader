import type { ReactNode } from 'react'
import { Group, Panel } from 'react-resizable-panels'
import { MAX_PANES, PANEL_MIN } from '../lib/config'
import { Pane } from './Pane'
import { SplitHandle } from './SplitHandle'
import type { Chapter, Lang, LayoutNode, SplitDir, SplitNode } from '../types'

interface LayoutViewProps {
  root: LayoutNode
  chapter: Chapter | undefined
  paneCount: number
  onLangChange: (paneId: string, lang: Lang) => void
  onSplit: (paneId: string, dir: SplitDir, lang: Lang) => void
  onClose: (paneId: string) => void
  onRatio: (splitId: string, ratio: number) => void
}

/**
 * The window tree, rendered as nested resizable groups: a split is one `Group`,
 * each of its sides is a `Panel` holding either a pane or the next group.
 */
export function LayoutView({
  root,
  chapter,
  paneCount,
  onLangChange,
  onSplit,
  onClose,
  onRatio,
}: LayoutViewProps) {
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
          onLangChange={(lang) => onLangChange(node.id, lang)}
          onSplit={(dir) => onSplit(node.id, dir, node.lang)}
          onClose={() => onClose(node.id)}
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
        if (typeof ratio === 'number') onRatio(node.id, ratio)
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
