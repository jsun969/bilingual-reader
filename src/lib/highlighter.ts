import { createHighlighter } from 'shiki'
import type { BundledLanguage, Highlighter } from 'shiki'
import { OSTEP_THEME, OSTEP_THEME_NAME } from './shikiTheme'

let highlighterPromise: Promise<Highlighter> | null = null
const languageLoads = new Map<string, Promise<void | null>>()

function getHighlighter(): Promise<Highlighter> {
  // No grammars up front: each one is pulled in the first time a chapter uses it.
  highlighterPromise ??= createHighlighter({ themes: [OSTEP_THEME], langs: [] })
  return highlighterPromise
}

/**
 * Tokenises one code block with the page's palette and returns the inner HTML
 * for the caller's own `<code>` element.
 *
 * Returns `null` when there is no grammar for the language (or the grammar fails
 * to load): the block then stays plain monospace, which is what the book's ASCII
 * diagrams need — guessing at them mangles the picture.
 */
export async function highlightCode(code: string, language: string): Promise<string | null> {
  const highlighter = await getHighlighter()

  let loading = languageLoads.get(language)
  if (!loading) {
    // Grammar names come from the chapter files, so they are arbitrary strings;
    // shiki resolves them against its bundled grammars at runtime.
    loading = highlighter.loadLanguage(language as BundledLanguage).catch(() => null)
    languageLoads.set(language, loading)
  }
  if ((await loading) === null) return null

  const html = highlighter.codeToHtml(code, { lang: language, theme: OSTEP_THEME_NAME })
  const holder = document.createElement('template')
  holder.innerHTML = html
  const tokens = holder.content.firstElementChild?.querySelector('code')
  return tokens ? tokens.innerHTML : null
}
