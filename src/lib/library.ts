import { create } from 'zustand'
import { deleteHandle, getHandle, putHandle, readMetas, writeMetas } from './idb'
import {
  ImportError,
  isMissingFolder,
  permissionOf,
  releaseChapterUrls,
  requestPermission,
  scanChapter,
} from './fs'
import { dropChapterDocs } from './docs'
import type { Chapter, ChapterFiles, ChapterMeta } from '../types'

/**
 * The reader's own bookshelf: one book, many chapters, each chapter a folder the
 * reader imported. The folder's *handle* lives in IndexedDB (and is checked
 * again on every visit); everything else a chapter needs to be listed — its id,
 * number, title and file names — is JSON in `localStorage`.
 *
 * A chapter whose folder the browser cannot open right now is not dropped: it
 * stays on the shelf as `needs-permission` (one click away) or `missing` (a
 * relocated folder, waiting to be relinked or removed).
 */

/** Numbers sort first by value, then everything unparsable, then by title. */
export function orderOf(num: string): number {
  const parsed = Number.parseInt(num, 10)
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER
}

function sortChapters(chapters: Chapter[]): Chapter[] {
  return [...chapters].sort(
    (a, b) => a.order - b.order || a.title.localeCompare(b.title) || a.id.localeCompare(b.id),
  )
}

function toMeta(chapter: Chapter): ChapterMeta {
  return {
    id: chapter.id,
    num: chapter.num,
    title: chapter.title,
    order: chapter.order,
    ...(chapter.adhd ? { adhd: chapter.adhd } : {}),
    sources: chapter.sources,
  }
}

function newId(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
}

/** The chapter as it stands with its folder unreadable: the reason decides which. */
function unreadable(meta: ChapterMeta, handle: FileSystemDirectoryHandle | undefined): Chapter {
  return { ...meta, handle, status: 'missing' }
}

/** Reads a folder again, folding whatever is inside onto the stored chapter. */
async function scanInto(meta: ChapterMeta, handle: FileSystemDirectoryHandle): Promise<Chapter> {
  try {
    const files = await scanChapter(handle)
    return { ...meta, ...files, handle, status: 'ready' }
  } catch (error) {
    if (error instanceof ImportError || isMissingFolder(error)) return unreadable(meta, handle)
    // Anything else (a permission that lapsed mid-read, say) is retried on click.
    return { ...meta, handle, status: 'needs-permission' }
  }
}

interface LibraryStore {
  chapters: Chapter[]
  /** True while the stored handles are being checked against the disk. */
  restoring: boolean
  /** Rebuilds the shelf from `localStorage` + IndexedDB. Safe to call twice. */
  restore: () => Promise<void>
  importChapter: (
    handle: FileSystemDirectoryHandle,
    num: string,
    title: string,
    files: ChapterFiles,
  ) => Promise<Chapter>
  renameChapter: (id: string, num: string, title: string) => void
  /** Points an existing chapter at a freshly picked folder (after a move). */
  relinkChapter: (
    id: string,
    handle: FileSystemDirectoryHandle,
    files: ChapterFiles,
  ) => Promise<void>
  removeChapter: (id: string) => Promise<void>
  /** Makes a chapter readable, prompting for permission when it must. */
  makeReady: (id: string) => Promise<'ready' | 'relink' | 'denied'>
}

/**
 * The chapter list comes out of `localStorage` synchronously, so the shelf is
 * already populated on the first paint; only the folder handles need a round
 * trip through IndexedDB, which `restore()` does once.
 */
const booted: Chapter[] = readMetas().map((meta) => ({ ...meta, status: 'loading' }))

let started = false

export const useLibraryStore = create<LibraryStore>()((set, get) => {
  const persist = (chapters: Chapter[]): void => {
    writeMetas(chapters.map(toMeta))
  }

  const replace = (id: string, next: Chapter): Chapter[] => {
    const chapters = sortChapters(get().chapters.map((c) => (c.id === id ? next : c)))
    set({ chapters })
    persist(chapters)
    return chapters
  }

  const restoreOne = async (meta: ChapterMeta): Promise<Chapter> => {
    let handle: FileSystemDirectoryHandle | undefined
    try {
      handle = await getHandle(meta.id)
    } catch {
      return unreadable(meta, undefined)
    }
    if (!handle) return unreadable(meta, undefined)
    if ((await permissionOf(handle)) !== 'granted') {
      return { ...meta, handle, status: 'needs-permission' }
    }
    return scanInto(meta, handle)
  }

  return {
    chapters: booted,
    restoring: booted.length > 0,

    restore: async () => {
      if (started) return
      started = true
      const metas = readMetas()
      if (!metas.length) {
        set({ restoring: false, chapters: [] })
        return
      }
      set({ restoring: true, chapters: metas.map((meta) => ({ ...meta, status: 'loading' })) })
      const restored: Chapter[] = []
      // Sequential: one folder at a time keeps the disk busy, not the tab.
      for (const meta of metas) restored.push(await restoreOne(meta))
      // The shelf stays usable while this runs: keep whatever was imported or
      // removed in the meantime instead of overwriting it with the boot list.
      const restoredIds = new Set(restored.map((chapter) => chapter.id))
      const live = new Set(get().chapters.map((chapter) => chapter.id))
      const chapters = sortChapters([
        ...restored.filter((chapter) => live.has(chapter.id)),
        ...get().chapters.filter((chapter) => !restoredIds.has(chapter.id)),
      ])
      set({ chapters, restoring: false })
      persist(chapters)
    },

    importChapter: async (handle, num, title, files) => {
      const meta: ChapterMeta = { id: newId(), num, title, order: orderOf(num), ...files }
      try {
        await putHandle(meta.id, handle)
      } catch {
        /* no IndexedDB: the chapter still reads this session, just not the next */
      }
      const chapter: Chapter = { ...meta, handle, status: 'ready' }
      const chapters = sortChapters([...get().chapters, chapter])
      set({ chapters })
      persist(chapters)
      return chapter
    },

    renameChapter: (id, num, title) => {
      const chapter = get().chapters.find((c) => c.id === id)
      if (!chapter) return
      replace(id, { ...chapter, num, title, order: orderOf(num) })
    },

    relinkChapter: async (id, handle, files) => {
      const chapter = get().chapters.find((c) => c.id === id)
      if (!chapter) return
      try {
        await putHandle(id, handle)
      } catch {
        /* see importChapter */
      }
      replace(id, { ...chapter, ...files, handle, status: 'ready' })
    },

    removeChapter: async (id) => {
      try {
        await deleteHandle(id)
      } catch {
        /* the record was never written */
      }
      releaseChapterUrls(id)
      dropChapterDocs(id)
      const chapters = get().chapters.filter((c) => c.id !== id)
      set({ chapters })
      persist(chapters)
    },

    makeReady: async (id) => {
      const chapter = get().chapters.find((c) => c.id === id)
      if (!chapter || chapter.status === 'loading') return 'denied'
      if (chapter.status === 'ready') return 'ready'
      if (!chapter.handle) return 'relink'
      if (chapter.status === 'needs-permission' && !(await requestPermission(chapter.handle))) {
        return 'denied'
      }
      const next = await scanInto(chapter, chapter.handle)
      replace(id, next)
      return next.status === 'ready' ? 'ready' : 'relink'
    },
  }
})
