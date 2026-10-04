import type { Catalog, Chapter, RenderedDoc } from '../types'

/** Rendered chapter HTML, kept in memory for the session (it is far too big to store). */
export const docCache = new Map<string, RenderedDoc>()

/** Pane ids are unique, so this keys both the cache and the reading positions. */
export function viewKey(paneId: string, slug: string, lang: string): string {
  return `${paneId}/${slug}/${lang}`
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
