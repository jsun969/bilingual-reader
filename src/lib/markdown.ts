import { Marked } from 'marked'
import markedFootnote from 'marked-footnote'
import { highlightCode } from './highlighter'
import type { OutlineItem, RenderedDoc } from '../types'

const md = new Marked({ gfm: true, breaks: false })
md.use(markedFootnote())

function headingId(text: string): string {
  const slug = text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{Letter}\p{Number}\-_.]/gu, '')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
  return slug || 'sec'
}

function claimId(prefix: string, candidate: string, used: Set<string>): string {
  let id = prefix + candidate
  let n = 2
  while (used.has(id)) id = `${prefix}${candidate}-${n++}`
  used.add(id)
  return id
}

/**
 * Renders one chapter file for one pane.
 *
 * Every id in the document gets a per-pane prefix, so both panes can show the
 * same chapter without colliding and in-text references (`#fig-4-1`, footnotes)
 * still scroll the right pane through plain fragment navigation.
 */
export async function renderDoc(
  source: string,
  options: {
    idPrefix: string
    /** Resolves a markdown-relative image path to a URL, or `undefined` if absent. */
    resolveAsset: (src: string) => Promise<string | undefined>
  },
): Promise<RenderedDoc> {
  const template = document.createElement('template')
  template.innerHTML = md.parse(source, { async: false }) as string
  const frag = template.content
  const used = new Set<string>()
  const renamed = new Map<string, string>()

  // Existing ids (figures, footnote items) first, then rewrite the links to them.
  for (const node of frag.querySelectorAll<HTMLElement>('[id]')) {
    const id = claimId(options.idPrefix, node.id, used)
    renamed.set(node.id, id)
    node.id = id
  }
  for (const link of frag.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')) {
    const target = renamed.get(link.getAttribute('href')!.slice(1))
    if (target) link.setAttribute('href', `#${target}`)
  }

  const outline: OutlineItem[] = []
  for (const heading of frag.querySelectorAll<HTMLElement>('h1, h2, h3, h4')) {
    const text = (heading.textContent ?? '').replace(/\s+/g, ' ').trim()
    const id = claimId(options.idPrefix, headingId(text), used)
    heading.id = id
    outline.push({ id, level: Number(heading.tagName[1]), text })
  }

  await Promise.all(
    [...frag.querySelectorAll<HTMLImageElement>('img')].map(async (image) => {
      const src = image.getAttribute('src') ?? ''
      // Relative paths point inside the chapter folder, not the page: the caller
      // resolves them against the imported directory (blob URL or nothing).
      if (src && !/^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(src)) {
        const url = await options.resolveAsset(src)
        if (url) image.setAttribute('src', url)
      }
      image.loading = 'lazy'
      image.decoding = 'async'
    }),
  )

  for (const link of frag.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    const href = link.getAttribute('href')!
    if (/^https?:/i.test(href)) {
      link.target = '_blank'
      link.rel = 'noreferrer'
    }
  }

  await Promise.all(
    [...frag.querySelectorAll<HTMLElement>('pre > code')].map(async (code) => {
      const language = [...code.classList]
        .find((name) => name.startsWith('language-'))
        ?.slice('language-'.length)
      const text = code.textContent ?? ''
      // Unlabelled fences are usually ASCII diagrams; leave them alone.
      if (!language || text.length > 120_000) return
      const highlighted = await highlightCode(text, language)
      if (highlighted === null) return
      code.innerHTML = highlighted
      code.classList.add('shiki')
    }),
  )

  return { html: template.innerHTML, outline }
}
