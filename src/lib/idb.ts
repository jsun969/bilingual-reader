import type { ChapterMeta } from '../types'

/**
 * Folder handles live in IndexedDB: they are structured-cloneable but not
 * JSON, so `localStorage` cannot hold them. Everything here degrades to a
 * no-op when IndexedDB is missing or blocked, and the caller then treats the
 * folder as gone.
 */

const DB_NAME = 'bilingual-reader'
const DB_VERSION = 1
const HANDLES = 'handles'

/**
 * The chapter list (numbers, titles, file names) is small JSON, so it stays in
 * `localStorage`: that is what the UI reads at boot, and IndexedDB only ever
 * adds the live handle back onto it.
 */
const METAS_KEY = 'bilingual-reader:library'

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB 请求失败'))
  })
}

let dbPromise: Promise<IDBDatabase> | undefined

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(HANDLES)) req.result.createObjectStore(HANDLES)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('无法打开 IndexedDB'))
    req.onblocked = () => reject(new Error('IndexedDB 被其他标签页占用'))
  })
  return dbPromise
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (objectStore: IDBObjectStore) => Promise<T> | T,
): Promise<T> {
  const db = await openDb()
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(HANDLES, mode)
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB 事务失败'))
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB 事务中断'))
    Promise.resolve(run(transaction.objectStore(HANDLES))).then(resolve, reject)
  })
}

export async function putHandle(id: string, handle: FileSystemDirectoryHandle): Promise<void> {
  await withStore('readwrite', (objectStore) => request(objectStore.put(handle, id)))
}

export async function getHandle(id: string): Promise<FileSystemDirectoryHandle | undefined> {
  const value = (await withStore('readonly', (objectStore) => request(objectStore.get(id)))) as
    | FileSystemHandle
    | undefined
  // Stored handles are directories; anything else is a stale record.
  return value?.kind === 'directory' ? (value as FileSystemDirectoryHandle) : undefined
}

export async function deleteHandle(id: string): Promise<void> {
  await withStore('readwrite', (objectStore) => request(objectStore.delete(id)))
}

export function readMetas(): ChapterMeta[] {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(METAS_KEY)
  } catch {
    return []
  }
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isMeta) : []
  } catch {
    return []
  }
}

export function writeMetas(metas: ChapterMeta[]): void {
  try {
    localStorage.setItem(METAS_KEY, JSON.stringify(metas))
  } catch {
    /* private mode or quota: the library keeps working in memory */
  }
}

function isMeta(value: unknown): value is ChapterMeta {
  if (typeof value !== 'object' || value === null) return false
  const meta = value as Partial<ChapterMeta>
  return (
    typeof meta.id === 'string' &&
    meta.id !== '' &&
    typeof meta.num === 'string' &&
    typeof meta.title === 'string' &&
    typeof meta.order === 'number' &&
    typeof meta.sources === 'object' &&
    meta.sources !== null
  )
}
