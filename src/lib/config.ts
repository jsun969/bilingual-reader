import type { Lang, ViewState } from '../types'

export const DESKTOP_QUERY = '(min-width: 901px)'
export const RATIO_MIN = 22
export const RATIO_MAX = 78
export const RATIO_CENTER = 50
export const PREFERS_REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const LANGS: readonly Lang[] = ['zh', 'en', 'pdf']

const STORE_KEY = 'bilingual-reader:viewer'

export const DEFAULT_VIEW: ViewState = {
  left: 'zh',
  right: 'en',
  ratio: RATIO_CENTER,
  split: true,
}

/** Keeps the divider inside a range where both panes stay readable. */
export function clampRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) return DEFAULT_VIEW.ratio
  return Math.min(RATIO_MAX, Math.max(RATIO_MIN, ratio))
}

function readLang(value: unknown, fallback: Lang): Lang {
  return LANGS.includes(value as Lang) ? (value as Lang) : fallback
}

export function readViewState(): ViewState {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(STORE_KEY)
  } catch {
    return DEFAULT_VIEW
  }
  if (!raw) return DEFAULT_VIEW
  try {
    const parsed = JSON.parse(raw) as Partial<ViewState>
    return {
      chapter: typeof parsed.chapter === 'string' ? parsed.chapter : undefined,
      left: readLang(parsed.left, DEFAULT_VIEW.left),
      right: readLang(parsed.right, DEFAULT_VIEW.right),
      ratio: clampRatio(Number(parsed.ratio)),
      split: parsed.split !== false,
    }
  } catch {
    return DEFAULT_VIEW
  }
}

export function writeViewState(state: ViewState): void {
  try {
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify({
        chapter: state.chapter,
        left: state.left,
        right: state.right,
        ratio: state.ratio,
        split: state.split,
      }),
    )
  } catch {
    /* private mode: view state lives in memory only */
  }
}
