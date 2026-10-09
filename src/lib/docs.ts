import type { Chapter, RenderedDoc } from '../types'

/** Rendered chapter HTML, kept in memory for the session (it is far too big to store). */
export const docCache = new Map<string, RenderedDoc>()

/** Blob URLs handed to the PDF frame, one per chapter, for the session. */
export const pdfUrls = new Map<string, string>()

/** Pane ids are unique, so this keys both the cache and the reading positions. */
export function viewKey(paneId: string, chapterId: string, lang: string): string {
  return `${paneId}/${chapterId}/${lang}`
}

export function findChapter(chapters: Chapter[], id: string | undefined): Chapter | undefined {
  return chapters.find((chapter) => chapter.id === id)
}

/** Forgets everything rendered for a chapter, for when it leaves the shelf. */
export function dropChapterDocs(chapterId: string): void {
  const marker = `/${chapterId}/`
  for (const key of [...docCache.keys()]) {
    if (key.includes(marker)) docCache.delete(key)
  }
  const pdf = pdfUrls.get(chapterId)
  if (pdf) {
    URL.revokeObjectURL(pdf)
    pdfUrls.delete(chapterId)
  }
}
