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

export interface MarkdownSource {
  /** URL the browser fetches the raw markdown from, e.g. /asset/chapter04-Processes/zh.md */
  path: string
  /** Estimated reading time in minutes. */
  minutes: number
}

export interface PdfSource {
  path: string
  bytes: number
}

export interface Chapter {
  /** Directory name under the asset root, e.g. chapter04-Processes */
  slug: string
  /** Chapter number exactly as written in the directory name, e.g. "04". */
  num: string
  /** Numeric order used for sorting. */
  order: number
  /** Human title derived from the directory name, e.g. "Processes". */
  title: string
  sources: {
    zh?: MarkdownSource
    en?: MarkdownSource
    pdf?: PdfSource
  }
}

export interface Catalog {
  /** Name of the scanned asset directory, e.g. "asset". */
  assetDir: string
  chapters: Chapter[]
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
