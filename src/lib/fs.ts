import { readingMinutes } from './reading'
import type { ChapterFiles, MarkdownSource, PdfSource } from '../types'

/**
 * The whole filesystem side of the reader: pick a folder, read what is inside
 * it, remember permission, and hand out blob URLs. Built on the Chromium-only
 * File System Access API — `pickerSupported()` gates the UI on it.
 */

/** Thrown when a folder has nothing this reader knows how to open. */
export class ImportError extends Error {
  constructor() {
    super('文件夹里没有可识别的文件')
    this.name = 'ImportError'
  }
}

/** Chromium drops the folder from under us: the handle stays, the contents do not. */
export function isMissingFolder(error: unknown): boolean {
  const name = error instanceof DOMException ? error.name : undefined
  return name === 'NotFoundError' || name === 'TypeMismatchError'
}

export function pickerSupported(): boolean {
  return typeof window.showDirectoryPicker === 'function'
}

/** The folder the reader just picked, or `undefined` when the picker was cancelled. */
export async function pickDirectory(): Promise<FileSystemDirectoryHandle | undefined> {
  try {
    return await window.showDirectoryPicker!({ id: 'bilingual-reader', mode: 'read' })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return undefined
    throw error
  }
}

/** The folder that was dropped on the dialog, if the drop even carried one. */
export async function droppedDirectory(
  item: DataTransferItem,
): Promise<FileSystemDirectoryHandle | undefined> {
  const handle = await item.getAsFileSystemHandle?.()
  return handle?.kind === 'directory' ? (handle as FileSystemDirectoryHandle) : undefined
}

export async function permissionOf(handle: FileSystemDirectoryHandle): Promise<PermissionState> {
  try {
    return await handle.queryPermission({ mode: 'read' })
  } catch {
    // A browser without the permission API: assume the handle still works.
    return 'granted'
  }
}

/** Asks for read access. Only Chrome/Edge can answer, and only on a user gesture. */
export async function requestPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    if ((await handle.queryPermission({ mode: 'read' })) === 'granted') return true
    return (await handle.requestPermission({ mode: 'read' })) === 'granted'
  } catch {
    return false
  }
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot).toLowerCase() : ''
}

async function textOf(handle: FileSystemFileHandle): Promise<string | undefined> {
  try {
    return await (await handle.getFile()).text()
  } catch {
    return undefined
  }
}

/**
 * Reads one chapter folder: `zh.md` / `en.md` are the two languages, `adhd.md`
 * the optional condensed rendition, any `.pdf` the original. Anything else —
 * figures, notes — is left alone and reached by relative path when a document
 * references it. Throws `ImportError` when none of the known names are there.
 */
export async function scanChapter(dir: FileSystemDirectoryHandle): Promise<ChapterFiles> {
  const markdown: { name: string; handle: FileSystemFileHandle }[] = []
  const pdfs: { name: string; handle: FileSystemFileHandle }[] = []

  // `entries()` is what throws NotFoundError once the folder is moved or deleted.
  for await (const [name, entry] of dir.entries()) {
    if (name.startsWith('.') || entry.kind !== 'file') continue
    const file = entry as FileSystemFileHandle
    const ext = extensionOf(name)
    if (ext === '.md') markdown.push({ name, handle: file })
    else if (ext === '.pdf') pdfs.push({ name, handle: file })
  }

  const sources: ChapterFiles['sources'] = {}
  let adhd: MarkdownSource | undefined
  markdown.sort((a, b) => a.name.localeCompare(b.name))
  for (const file of markdown) {
    const stem = file.name.slice(0, -3).toLowerCase()
    if (stem !== 'zh' && stem !== 'en' && stem !== 'adhd') continue
    const text = await textOf(file.handle)
    if (text === undefined) continue
    const source: MarkdownSource = { name: file.name, minutes: readingMinutes(text) }
    if (stem === 'adhd') adhd = source
    else sources[stem] = source
  }

  pdfs.sort((a, b) => a.name.localeCompare(b.name))
  if (pdfs[0]) {
    try {
      const pdf: PdfSource = { name: pdfs[0].name, bytes: (await pdfs[0].handle.getFile()).size }
      sources.pdf = pdf
    } catch {
      /* unreadable, skip */
    }
  }

  if (!Object.keys(sources).length) throw new ImportError()
  return { ...(adhd ? { adhd } : {}), sources }
}

/** The text of one named file inside the folder. Throws when it is gone. */
export async function readText(dir: FileSystemDirectoryHandle, name: string): Promise<string> {
  return (await (await dir.getFileHandle(name)).getFile()).text()
}

/** A blob URL for one named file, for the PDF frame and the "open original" link. */
export async function fileUrl(dir: FileSystemDirectoryHandle, name: string): Promise<string> {
  return URL.createObjectURL(await (await dir.getFileHandle(name)).getFile())
}

/**
 * Blob URLs minted for the figures a document references, keyed by chapter and
 * relative path, so both panes showing the same chapter share one.
 */
const assetUrls = new Map<string, string>()

/** A relative path from markdown, resolved to a blob URL, or `undefined`. */
export async function assetUrl(
  dir: FileSystemDirectoryHandle,
  chapterId: string,
  src: string,
): Promise<string | undefined> {
  const rel = normalizePath(src)
  if (!rel) return undefined
  const key = `${chapterId}\u0000${rel}`
  const cached = assetUrls.get(key)
  if (cached) return cached

  try {
    let node: FileSystemDirectoryHandle = dir
    const segments = rel.split('/')
    for (const segment of segments.slice(0, -1)) node = await node.getDirectoryHandle(segment)
    const file = await node.getFileHandle(segments[segments.length - 1])
    const url = URL.createObjectURL(await file.getFile())
    assetUrls.set(key, url)
    return url
  } catch {
    // Not in the folder (or an absolute/CDN path the caller already skipped).
    return undefined
  }
}

/** Drops the blob URLs a chapter handed out; call it when the chapter leaves. */
export function releaseChapterUrls(chapterId: string): void {
  const prefix = `${chapterId}\u0000`
  for (const [key, url] of assetUrls) {
    if (!key.startsWith(prefix)) continue
    URL.revokeObjectURL(url)
    assetUrls.delete(key)
  }
}

/**
 * `./fig-4-1.png`, `images/fig-4-1.png` and `../img/x.png` all end up a clean
 * relative path under the chapter folder; percent-escapes are decoded, and
 * anything that climbs above the folder (or is absolute) is refused.
 */
function normalizePath(src: string): string | undefined {
  const clean = src.split(/[?#]/)[0]
  if (!clean || /^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(clean)) return undefined
  const out: string[] = []
  for (const raw of clean.split('/')) {
    if (!raw || raw === '.') continue
    if (raw === '..') {
      if (!out.length) return undefined
      out.pop()
      continue
    }
    try {
      out.push(decodeURIComponent(raw))
    } catch {
      out.push(raw)
    }
  }
  return out.length ? out.join('/') : undefined
}
