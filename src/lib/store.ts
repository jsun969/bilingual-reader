import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PersistOptions, PersistStorage, StorageValue } from 'zustand/middleware'
import { LANGS, MAX_PANES, clampRatio, defaultLayout } from './config'
import { closePane, setPaneLang, setSplitRatio, splitPane } from './layout'
import type { Lang, LayoutNode, SplitDir, ViewState } from '../types'

const STORE_KEY = 'bilingual-reader:viewer'
/** A layout tree deeper than this is corrupt, not intentional. */
const MAX_DEPTH = 8
/** Reading positions are cheap but unbounded in number: keep the most recent ones. */
const SCROLL_LIMIT = 200
/** A scroll or a divider drag updates state every frame, so writes are coalesced. */
const WRITE_DELAY_MS = 250

/** What goes to storage: the view state plus where each pane was left. */
interface Persisted {
  chapter?: string
  layout: LayoutNode
  scroll: Record<string, number>
}

/** Stored data as it comes back out of `localStorage`: no field is trusted yet. */
interface StoredState {
  chapter?: unknown
  layout?: unknown
  scroll?: unknown
  /** Fields of the format written before the layout became a tree. */
  left?: unknown
  right?: unknown
  split?: unknown
  ratio?: unknown
}

/** A stored layout node, before any of its fields are checked. */
interface StoredNode {
  kind?: unknown
  id?: unknown
  dir?: unknown
  lang?: unknown
  ratio?: unknown
  first?: unknown
  second?: unknown
}

interface ViewerStore extends ViewState {
  /** Last scroll offset per `viewKey(paneId, slug, lang)`, least recently read first. */
  scroll: Record<string, number>
  openChapter: (slug: string) => void
  changeLang: (paneId: string, lang: Lang) => void
  addPane: (paneId: string, dir: SplitDir, lang: Lang) => void
  removePane: (paneId: string) => void
  resizeSplit: (splitId: string, ratio: number) => void
  rememberScroll: (key: string, offset: number) => void
}

function readLang(value: unknown): Lang | undefined {
  return LANGS.includes(value as Lang) ? (value as Lang) : undefined
}

/**
 * Rebuilds a layout tree from whatever was stored, dropping any part that is
 * malformed, too deep, or uses an id twice. Returns `null` for a bad tree, so
 * the caller can fall back to another source.
 */
function parseLayout(value: unknown): LayoutNode | null {
  const ids = new Set<string>()
  let panes = 0
  const parse = (raw: unknown, depth: number): LayoutNode | null => {
    if (typeof raw !== 'object' || raw === null || depth > MAX_DEPTH) return null
    const node = raw as StoredNode
    if (typeof node.id !== 'string' || node.id === '' || ids.has(node.id)) return null
    ids.add(node.id)

    if (node.kind === 'pane') {
      if (++panes > MAX_PANES) return null
      return { kind: 'pane', id: node.id, lang: readLang(node.lang) ?? 'zh' }
    }
    if (node.kind !== 'split' || (node.dir !== 'row' && node.dir !== 'col')) return null
    const first = parse(node.first, depth + 1)
    const second = parse(node.second, depth + 1)
    if (!first || !second) return null
    return {
      kind: 'split',
      id: node.id,
      dir: node.dir,
      ratio: clampRatio(Number(node.ratio)),
      first,
      second,
    }
  }
  return parse(value, 0)
}

/**
 * The layout as stored before it became a tree: a fixed pair of panes with one
 * ratio and a `split` flag. Only read back to keep the saved chapter, languages
 * and reading ratio across that upgrade.
 */
function layoutFromLegacy(raw: StoredState): LayoutNode | null {
  if (raw.left === undefined && raw.right === undefined && raw.split === undefined) return null
  const left = readLang(raw.left) ?? 'zh'
  if (raw.split === false) return { kind: 'pane', id: 'p1', lang: left }
  return {
    kind: 'split',
    id: 'g1',
    dir: 'row',
    ratio: clampRatio(Number(raw.ratio)),
    first: { kind: 'pane', id: 'p1', lang: left },
    second: { kind: 'pane', id: 'p2', lang: readLang(raw.right) ?? 'en' },
  }
}

function readScroll(value: unknown): Record<string, number> {
  if (typeof value !== 'object' || value === null) return {}
  const entries = Object.entries(value).filter(
    (entry): entry is [string, number] => typeof entry[1] === 'number' && entry[1] > 0,
  )
  return Object.fromEntries(
    entries.slice(-SCROLL_LIMIT).map(([key, top]) => [key, Math.round(top)]),
  )
}

let pending: { name: string; value: StorageValue<Persisted> } | null = null
let timer: number | undefined

function flush(): void {
  if (timer !== undefined) {
    clearTimeout(timer)
    timer = undefined
  }
  if (!pending) return
  const { name, value } = pending
  pending = null
  try {
    localStorage.setItem(name, JSON.stringify(value))
  } catch {
    /* private mode or quota: the store keeps working in memory */
  }
}

/**
 * `localStorage` with a write delay in front of it: the store is the source of
 * truth, storage just trails it by a quarter second.
 */
const storage: PersistStorage<Persisted> = {
  getItem: (name) => {
    try {
      const raw = localStorage.getItem(name)
      if (!raw) return null
      const parsed: unknown = JSON.parse(raw)
      if (typeof parsed !== 'object' || parsed === null) return null
      const stored = parsed as StoredState & { state?: unknown; version?: unknown }
      // Before zustand, the stored value was the view state itself, unwrapped.
      const state =
        typeof stored.state === 'object' && stored.state !== null
          ? (stored.state as Persisted)
          : (parsed as Persisted)
      const version = typeof stored.version === 'number' ? stored.version : undefined
      return { state, version }
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    pending = { name, value }
    timer ??= window.setTimeout(flush, WRITE_DELAY_MS)
  },
  removeItem: (name) => {
    pending = null
    try {
      localStorage.removeItem(name)
    } catch {
      /* nothing to remove */
    }
  },
}

// The last write must not be lost when the tab goes away.
window.addEventListener('pagehide', flush)

const options: PersistOptions<ViewerStore, Persisted> = {
  name: STORE_KEY,
  version: 1,
  storage,
  partialize: (state) => ({ chapter: state.chapter, layout: state.layout, scroll: state.scroll }),
  merge: (persisted, current) => {
    const raw = (typeof persisted === 'object' && persisted !== null ? persisted : {}) as StoredState
    return {
      ...current,
      chapter: typeof raw.chapter === 'string' ? raw.chapter : undefined,
      layout: parseLayout(raw.layout) ?? layoutFromLegacy(raw) ?? defaultLayout(),
      scroll: readScroll(raw.scroll),
    }
  },
}

export const useViewerStore = create<ViewerStore>()(
  persist(
    (set) => ({
      chapter: undefined,
      layout: defaultLayout(),
      scroll: {},

      openChapter: (slug) => set({ chapter: slug }),

      // Each layout change rebuilds the tree and only writes when it differs, so
      // the same ratio arriving on every frame of a drag is not a state change.
      changeLang: (paneId, lang) =>
        set((state) => {
          const layout = setPaneLang(state.layout, paneId, lang)
          return layout === state.layout ? state : { layout }
        }),

      addPane: (paneId, dir, lang) =>
        set((state) => {
          const layout = splitPane(state.layout, paneId, dir, lang)
          return layout === state.layout ? state : { layout }
        }),

      removePane: (paneId) =>
        set((state) => {
          const layout = closePane(state.layout, paneId)
          return !layout || layout === state.layout ? state : { layout }
        }),

      resizeSplit: (splitId, ratio) =>
        set((state) => {
          const layout = setSplitRatio(state.layout, splitId, ratio)
          return layout === state.layout ? state : { layout }
        }),

      rememberScroll: (key, offset) =>
        set((state) => {
          const top = Math.round(offset)
          if (state.scroll[key] === top) return state
          const scroll = { ...state.scroll }
          // Re-inserting keeps the map in least-recently-read order.
          delete scroll[key]
          scroll[key] = top
          const keys = Object.keys(scroll)
          for (const stale of keys.slice(0, keys.length - SCROLL_LIMIT)) delete scroll[stale]
          return { scroll }
        }),
    }),
    options,
  ),
)
