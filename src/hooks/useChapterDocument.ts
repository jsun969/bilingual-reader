import { useEffect, useState } from 'react'
import type { Chapter, ChapterDoc, Lang, MarkdownSource } from '../types'
import { docCache, pdfUrls, viewKey } from '../lib/docs'
import { assetUrl, fileUrl, readText } from '../lib/fs'
import { renderDoc } from '../lib/markdown'

const IDLE: ChapterDoc = { status: 'idle', html: '', outline: [], detail: '' }
const MISSING: ChapterDoc = { status: 'missing', html: '', outline: [], detail: '' }

/**
 * Loads and renders one markdown file out of the chapter's folder. Results are
 * cached under `cacheKey`, so flipping between 中文 and English — or reopening
 * the ADHD panel — never reads the file twice. `missing` tells the difference
 * between "nothing is selected" (idle) and "this chapter has no such file"
 * (missing, which the pane explains).
 */
function useRenderedDoc(
  chapter: Chapter | undefined,
  source: MarkdownSource | undefined,
  cacheKey: string | undefined,
  idPrefix: string,
  missing: boolean,
): ChapterDoc {
  const [doc, setDoc] = useState<ChapterDoc>(IDLE)
  const id = chapter?.id
  const handle = chapter?.handle
  const name = source?.name

  useEffect(() => {
    if (!id || !handle || !name || !cacheKey) {
      setDoc(missing ? MISSING : IDLE)
      return
    }

    const cached = docCache.get(cacheKey)
    if (cached) {
      setDoc({ status: 'ready', html: cached.html, outline: cached.outline, detail: '' })
      return
    }

    // Reading a local file is fast but not instant, and the reader may switch
    // chapters mid-read; a flag is all the cancellation this needs.
    let cancelled = false
    setDoc({ status: 'loading', html: '', outline: [], detail: '' })

    void (async () => {
      try {
        const text = await readText(handle, name)
        const rendered = await renderDoc(text, {
          idPrefix,
          resolveAsset: (src) => assetUrl(handle, id, src),
        })
        if (cancelled) return
        docCache.set(cacheKey, rendered)
        setDoc({ status: 'ready', html: rendered.html, outline: rendered.outline, detail: '' })
      } catch (error) {
        if (cancelled) return
        setDoc({ status: 'error', html: '', outline: [], detail: String(error) })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [id, handle, name, cacheKey, idPrefix, missing])

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
    chapter,
    source,
    chapter && markdown ? viewKey(paneId, chapter.id, lang) : undefined,
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
    chapter,
    chapter?.adhd,
    chapter ? viewKey(paneId, chapter.id, 'adhd') : undefined,
    `${paneId}-adhd-`,
    false,
  )
}

export interface PdfDoc {
  /** Blob URL of the original, handed to the browser's own PDF viewer. */
  url?: string
  detail: string
}

/** The chapter's PDF as a blob URL, minted once per chapter for the session. */
export function usePdfDocument(chapter: Chapter | undefined): PdfDoc {
  const [state, setState] = useState<PdfDoc>({ detail: '' })
  const id = chapter?.id
  const handle = chapter?.handle
  const name = chapter?.sources.pdf?.name

  useEffect(() => {
    if (!id || !handle || !name) {
      setState({ detail: '' })
      return
    }

    const cached = pdfUrls.get(id)
    if (cached) {
      setState({ url: cached, detail: '' })
      return
    }

    let cancelled = false
    void (async () => {
      try {
        const url = await fileUrl(handle, name)
        if (cancelled) {
          URL.revokeObjectURL(url)
          return
        }
        pdfUrls.set(id, url)
        setState({ url, detail: '' })
      } catch (error) {
        if (!cancelled) setState({ detail: String(error) })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [id, handle, name])

  return state
}
