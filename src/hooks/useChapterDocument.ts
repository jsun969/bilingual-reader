import { useEffect, useState } from 'react'
import type { Chapter, ChapterDoc, Lang, MarkdownSource } from '../types'
import { docCache, viewKey } from '../lib/catalog'
import { renderDoc } from '../lib/markdown'

const IDLE: ChapterDoc = { status: 'idle', html: '', outline: [], detail: '' }
const MISSING: ChapterDoc = { status: 'missing', html: '', outline: [], detail: '' }

/**
 * Loads and renders one markdown source. Results are cached under `cacheKey`, so
 * flipping between 中文 and English — or reopening the ADHD panel — never refetches.
 * `missing` tells the difference between "nothing is selected" (idle) and "this
 * chapter simply has no such file" (missing, which the pane explains).
 */
function useRenderedDoc(
  source: MarkdownSource | undefined,
  cacheKey: string | undefined,
  idPrefix: string,
  missing: boolean,
): ChapterDoc {
  const [doc, setDoc] = useState<ChapterDoc>(IDLE)

  useEffect(() => {
    if (!source || !cacheKey) {
      setDoc(missing ? MISSING : IDLE)
      return
    }

    const cached = docCache.get(cacheKey)
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
          idPrefix,
          assetUrl: new URL(source.path, location.href).href,
        })
        docCache.set(cacheKey, rendered)
        setDoc({ status: 'ready', html: rendered.html, outline: rendered.outline, detail: '' })
      } catch (error) {
        if (controller.signal.aborted) return
        setDoc({ status: 'error', html: '', outline: [], detail: String(error) })
      }
    })()

    return () => controller.abort()
  }, [source, cacheKey, idPrefix, missing])

  return doc
}

/** The chapter text one pane shows: the language's markdown, or nothing for a PDF. */
export function useChapterDocument(
  chapter: Chapter | undefined,
  lang: Lang,
  paneId: string,
): ChapterDoc {
  const isPdf = lang === 'pdf'
  const markdown = lang === 'zh' || lang === 'en'
  const source = chapter && markdown ? chapter.sources[lang] : undefined
  return useRenderedDoc(
    source,
    chapter && markdown ? viewKey(paneId, chapter.slug, lang) : undefined,
    `${paneId}-`,
    Boolean(chapter) && !isPdf,
  )
}

/**
 * The chapter's optional condensed rendition, rendered under its own id prefix
 * so its headings can never collide with the chapter's own anchors.
 */
export function useAdhdDocument(chapter: Chapter | undefined, paneId: string): ChapterDoc {
  return useRenderedDoc(
    chapter?.adhd,
    chapter ? viewKey(paneId, chapter.slug, 'adhd') : undefined,
    `${paneId}-adhd-`,
    false,
  )
}
