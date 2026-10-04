import { MAX_PANES, clampRatio } from './config'
import type { Lang, LayoutNode, PaneLeaf, SplitDir } from '../types'

/** Every window in the tree, left to right and top to bottom. */
export function countPanes(root: LayoutNode): number {
  return root.kind === 'pane' ? 1 : countPanes(root.first) + countPanes(root.second)
}

/** Ids only need to be unique and stable; `p1` / `g2` keeps storage readable. */
function nextId(root: LayoutNode, prefix: 'p' | 'g'): string {
  let max = 0
  const scan = (node: LayoutNode): void => {
    const match = new RegExp(`^${prefix}(\\d+)$`).exec(node.id)
    if (match) max = Math.max(max, Number(match[1]))
    if (node.kind === 'split') {
      scan(node.first)
      scan(node.second)
    }
  }
  scan(root)
  return `${prefix}${max + 1}`
}

export function splitPane(
  root: LayoutNode,
  paneId: string,
  dir: SplitDir,
  lang: Lang,
): LayoutNode {
  if (countPanes(root) >= MAX_PANES) return root
  const leaf: PaneLeaf = { kind: 'pane', id: nextId(root, 'p'), lang }
  const splitId = nextId(root, 'g')
  const insert = (node: LayoutNode): LayoutNode => {
    if (node.kind === 'pane') {
      if (node.id !== paneId) return node
      return { kind: 'split', id: splitId, dir, ratio: 50, first: node, second: leaf }
    }
    const first = insert(node.first)
    const second = insert(node.second)
    if (first === node.first && second === node.second) return node
    return { ...node, first, second }
  }
  return insert(root)
}

/** Removes one window and lets its sibling take the whole split. `null` when it was the last one. */
export function closePane(root: LayoutNode, paneId: string): LayoutNode | null {
  if (root.kind === 'pane') return root.id === paneId ? null : root
  const first = closePane(root.first, paneId)
  const second = closePane(root.second, paneId)
  if (first === root.first && second === root.second) return root
  if (!first) return second
  if (!second) return first
  return { ...root, first, second }
}

export function setPaneLang(root: LayoutNode, paneId: string, lang: Lang): LayoutNode {
  if (root.kind === 'pane') {
    if (root.id !== paneId || root.lang === lang) return root
    return { ...root, lang }
  }
  const first = setPaneLang(root.first, paneId, lang)
  const second = setPaneLang(root.second, paneId, lang)
  if (first === root.first && second === root.second) return root
  return { ...root, first, second }
}

export function setSplitRatio(root: LayoutNode, splitId: string, ratio: number): LayoutNode {
  const next = clampRatio(ratio)
  if (root.kind === 'pane') return root
  if (root.id === splitId) {
    return root.ratio === next ? root : { ...root, ratio: next }
  }
  const first = setSplitRatio(root.first, splitId, ratio)
  const second = setSplitRatio(root.second, splitId, ratio)
  if (first === root.first && second === root.second) return root
  return { ...root, first, second }
}
