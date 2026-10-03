import { useEffect, useState } from 'react'
import type { Chapter, ChapterDoc, Lang } from '../types'
import { docCache, viewKey } from '../lib/catalog'
import { renderDoc } from '../lib/markdown'

const IDLE: ChapterDoc = { status: 'idle', html: '', outline: [], detail: '' }

/**
 * Loads and renders the markdown for one pane. Results are cached per
 * pane/chapter/language, so flipping between 中文 and English never refetches.
 */
export function useChapterDocument(chapter: Chapter | undefined, lang: Lang, side: 'left' | 'right'): ChapterDoc {
  const [doc, setDoc] = useState<ChapterDoc>(IDLE)

  useEffect(() => {
    if (!chapter || lang === 'pdf') {
      setDoc(IDLE)
      return
    }

    const source = chapter.sources[lang]
    if (!source) {
      setDoc({ status: 'missing', html: '', outline: [], detail: '' })
      return
    }

    const key = viewKey(side, chapter.slug, lang)
    const cached = docCache.get(key)
    if (cached) {
      setDoc({ status: 'ready', html: cached.html, outline: cached.outline, detail: '' })
      return
    }

    const controller = new AbortController()
    setDoc({ status: 'loading', html: '', outline: [], detail: '' })

    void (async () => {
      try {
        const response = await fetch(source.path, { signal: controller.signal })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const text = await response.text()
        const rendered = await renderDoc(text, {
          idPrefix: side === 'left' ? 'L-' : 'R-',
          assetUrl: new URL(source.path, location.href).href,
        })
        docCache.set(key, rendered)
        setDoc({ status: 'ready', html: rendered.html, outline: rendered.outline, detail: '' })
      } catch (error) {
        if (controller.signal.aborted) return
        setDoc({ status: 'error', html: '', outline: [], detail: String(error) })
      }
    })()

    return () => controller.abort()
  }, [chapter, lang, side])

  return doc
}
