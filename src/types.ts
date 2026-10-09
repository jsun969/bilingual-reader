export type Lang = 'zh' | 'en' | 'pdf'

/** A leaf of the layout tree: one window showing one language of the chapter. */
export interface PaneLeaf {
  kind: 'pane'
  /** Stable id, unique in the tree; also the id prefix of this pane's document. */
  id: string
  lang: Lang
}

/** Split direction: two columns side by side (`row`) or two rows stacked (`col`). */
export type SplitDir = 'row' | 'col'

/** A split: `first` (left / top) and `second` (right / bottom), with `ratio` % for `first`. */
export interface SplitNode {
  kind: 'split'
  id: string
  dir: SplitDir
  ratio: number
  first: LayoutNode
  second: LayoutNode
}

export type LayoutNode = PaneLeaf | SplitNode

/** One markdown file inside a chapter folder, named exactly as it sits on disk. */
export interface MarkdownSource {
  /** File name inside the imported folder, e.g. `zh.md`. */
  name: string
  /** Estimated reading time in minutes. */
  minutes: number
}

export interface PdfSource {
  name: string
  bytes: number
}

/** What one folder yielded: the sources the reader knows how to open. */
export interface ChapterFiles {
  /**
   * Optional condensed rendition of the chapter, English, meant to be skimmed
   * in a panel of its own. Not a language: it sits beside `sources`, and a
   * chapter without it simply has no such panel.
   */
  adhd?: MarkdownSource
  sources: {
    zh?: MarkdownSource
    en?: MarkdownSource
    pdf?: PdfSource
  }
}

/**
 * A chapter as stored: the id it is known by, the number and title the reader
 * typed when importing the folder, and what was found inside it.
 */
export interface ChapterMeta extends ChapterFiles {
  /** Generated identity; also the key of the folder handle in IndexedDB. */
  id: string
  /** Chapter number as typed, e.g. "04". Empty when the reader left it blank. */
  num: string
  /** Chapter title as typed. */
  title: string
  /** Numeric order used for sorting; blank/unparsable numbers sort last. */
  order: number
}

/**
 * What the browser currently makes of a chapter's folder. `loading` is the
 * moment between the metadata coming out of `localStorage` and the handle
 * being checked; `needs-permission` waits for a click (Chromium only hands
 * back read access on a user gesture); `missing` is a folder that was moved,
 * deleted, or renamed away.
 */
export type ChapterStatus = 'loading' | 'ready' | 'needs-permission' | 'missing'

/** A stored chapter, its live folder handle, and the state of that handle. */
export interface Chapter extends ChapterMeta {
  status: ChapterStatus
  /** Undefined until the handle is recovered from IndexedDB or relinked. */
  handle?: FileSystemDirectoryHandle
}

export interface OutlineItem {
  id: string
  level: number
  text: string
}

export interface RenderedDoc {
  html: string
  outline: OutlineItem[]
}

export type DocStatus = 'idle' | 'loading' | 'ready' | 'missing' | 'error'

export interface ChapterDoc {
  status: DocStatus
  html: string
  outline: OutlineItem[]
  /** Human readable reason, filled for `error`. */
  detail: string
}

export interface ViewState {
  chapter?: string
  /** The window tree: every leaf is one pane, every split is one draggable divider. */
  layout: LayoutNode
}
