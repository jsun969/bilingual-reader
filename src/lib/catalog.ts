import type { Catalog, Chapter, RenderedDoc, Side } from '../types'

/** Rendered chapter HTML, shared between panes and kept across chapter switches. */
export const docCache = new Map<string, RenderedDoc>()

/** Last scroll offset per pane / chapter / language, so switching back keeps your place. */
export const scrollMemory = new Map<string, number>()

export function viewKey(side: Side, slug: string, lang: string): string {
  return `${side}/${slug}/${lang}`
}

export async function fetchCatalog(signal?: AbortSignal): Promise<Catalog> {
  const response = await fetch('/api/chapters.json', { signal })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const payload = (await response.json()) as Partial<Catalog>
  return { assetDir: payload.assetDir ?? 'asset', chapters: payload.chapters ?? [] }
}

export function findChapter(chapters: Chapter[], slug: string | undefined): Chapter | undefined {
  return chapters.find((chapter) => chapter.slug === slug)
}
