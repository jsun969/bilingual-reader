import type { Lang, LayoutNode } from '../types'

/** Four windows is as deep as the tree can get while both sides of every split stay usable. */
export const MAX_PANES = 4
export const PREFERS_REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const LANGS: readonly Lang[] = ['zh', 'en', 'pdf']

const RATIO_MIN = 22
const RATIO_MAX = 78
const RATIO_CENTER = 50

/** Smallest share of a split one of its two sides may take. */
export const PANEL_MIN = `${RATIO_MIN}%`

/** The default layout: a 中文 pane and an English pane, side by side. */
export function defaultLayout(): LayoutNode {
  return {
    kind: 'split',
    id: 'g1',
    dir: 'row',
    ratio: RATIO_CENTER,
    first: { kind: 'pane', id: 'p1', lang: 'zh' },
    second: { kind: 'pane', id: 'p2', lang: 'en' },
  }
}

/** Keeps a split inside a range where both of its sides stay readable. */
export function clampRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) return RATIO_CENTER
  return Math.min(RATIO_MAX, Math.max(RATIO_MIN, ratio))
}
