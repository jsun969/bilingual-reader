import type { Lang, LayoutNode, SplitDir, ViewState } from '../types'

export const DESKTOP_QUERY = '(min-width: 901px)'
/** Four windows is as deep as the tree can get while both sides of every split stay usable. */
export const MAX_PANES = 4
export const PREFERS_REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const LANGS: readonly Lang[] = ['zh', 'en', 'pdf']

const RATIO_MIN = 22
const RATIO_MAX = 78
const RATIO_CENTER = 50
const MAX_DEPTH = 8
const STORE_KEY = 'bilingual-reader:viewer'

/** Smallest share of a split one of its two sides may take. */
export const PANEL_MIN = `${RATIO_MIN}%`

/** The default windows: 中文 | English, side by side. */
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

function readLang(value: unknown, fallback: Lang): Lang {
  return LANGS.includes(value as Lang) ? (value as Lang) : fallback
}

function isDir(value: unknown): value is SplitDir {
  return value === 'row' || value === 'col'
}

/**
 * Rebuilds a layout tree from whatever is in storage, dropping any part that is
 * malformed, too deep, or uses an id twice. Returns `null` for a bad tree, so
 * the caller can fall back to a default one.
 */
export function parseLayout(value: unknown): LayoutNode | null {
  const ids = new Set<string>()
  let panes = 0
  const parse = (raw: unknown, depth: number): LayoutNode | null => {
    if (typeof raw !== 'object' || raw === null || depth > MAX_DEPTH) return null
    const node = raw as Record<string, unknown>
    const id = typeof node.id === 'string' && node.id !== '' ? node.id : null
    if (!id || ids.has(id)) return null
    ids.add(id)

    if (node.kind === 'pane') {
      if (++panes > MAX_PANES) return null
      return { kind: 'pane', id, lang: readLang(node.lang, 'zh') }
    }
    if (node.kind !== 'split' || !isDir(node.dir)) return null
    const first = parse(node.first, depth + 1)
    const second = parse(node.second, depth + 1)
    if (!first || !second) return null
    return { kind: 'split', id, dir: node.dir, ratio: clampRatio(Number(node.ratio)), first, second }
  }
  return parse(value, 0)
}

/**
 * State written before the layout became a tree: a fixed pair of panes with one
 * ratio and a `split` flag. Only read to keep saved reading positions and
 * languages across the upgrade.
 */
function legacyLayout(parsed: Record<string, unknown>): LayoutNode | null {
  if (parsed.left === undefined && parsed.right === undefined && parsed.split === undefined) {
    return null
  }
  const left = readLang(parsed.left, 'zh')
  if (parsed.split === false) return { kind: 'pane', id: 'p1', lang: left }
  return {
    kind: 'split',
    id: 'g1',
    dir: 'row',
    ratio: clampRatio(Number(parsed.ratio)),
    first: { kind: 'pane', id: 'p1', lang: left },
    second: { kind: 'pane', id: 'p2', lang: readLang(parsed.right, 'en') },
  }
}

export function readViewState(): ViewState {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(STORE_KEY)
  } catch {
    return { layout: defaultLayout() }
  }
  if (!raw) return { layout: defaultLayout() }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return {
      chapter: typeof parsed.chapter === 'string' ? parsed.chapter : undefined,
      layout: parseLayout(parsed.layout) ?? legacyLayout(parsed) ?? defaultLayout(),
    }
  } catch {
    return { layout: defaultLayout() }
  }
}

export function writeViewState(state: ViewState): void {
  try {
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify({ chapter: state.chapter, layout: state.layout }),
    )
  } catch {
    /* private mode: view state lives in memory only */
  }
}
