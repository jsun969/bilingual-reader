import fs from 'node:fs'
import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import type { Catalog, Chapter, MarkdownSource } from '../src/types.ts'

/**
 * Serves the asset folder (one directory per chapter) plus a chapter catalog
 * built by reading the filesystem on every request. Nothing about the asset
 * layout is hardcoded: add a directory, it shows up.
 */

const ASSET_DIR_CANDIDATES = ['asset', 'assets']
const CHAPTER_RE = /^chapter[-_ ]*(\d+)[-_ ]*(.*)$/i
const CJK_RE = /[\u3400-\u9fff\uf900-\ufaff]/g

const MIME: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.md': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
}

function findAssetRoot(projectRoot: string): string {
  for (const name of ASSET_DIR_CANDIDATES) {
    const dir = path.join(projectRoot, name)
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) return dir
  }
  return path.join(projectRoot, ASSET_DIR_CANDIDATES[0])
}

/** Lowercase words that link title-case words rather than forming compounds. */
const CONNECTORS = new Set([
  'a', 'an', 'and', 'as', 'at', 'by', 'for', 'from', 'in', 'of', 'on', 'or', 'the', 'to', 'via',
  'vs', 'with',
])

/**
 * Chapter titles come from the directory name: `chapter08-Multi-level-Feedback`
 * reads "Multi-level Feedback", `chapter18-Introduction-to-Paging` reads
 * "Introduction to Paging". A lowercase segment continues a hyphenated compound
 * unless it is one of the linking words above; an all-lowercase slug is plain
 * kebab-case and hyphens are word separators.
 */
function prettifySlug(slug: string): string {
  const parts = slug.split(/[-_]+/).filter(Boolean)
  if (!parts.some((part) => /^[A-Z0-9]/.test(part))) return parts.join(' ')

  let title = ''
  for (const part of parts) {
    if (!title) {
      title = part
      continue
    }
    const compound = /^[a-z]/.test(part) && !CONNECTORS.has(part.toLowerCase())
    title += (compound ? '-' : ' ') + part
  }
  return title
}

/** Minutes at ~420 CJK chars or ~230 latin words per minute, code stripped. */
function readingMinutes(markdown: string): number {
  const body = markdown.replace(/```[\s\S]*?```/g, ' ').replace(/<[^>]*>/g, ' ')
  const cjk = body.match(CJK_RE)?.length ?? 0
  const latin = body.replace(CJK_RE, ' ').match(/[A-Za-z][A-Za-z'’-]*/g)?.length ?? 0
  return Math.max(1, Math.round(cjk / 420 + latin / 230))
}

function scan(assetRoot: string, urlBase: string): Catalog {
  const chapters: Chapter[] = []
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(assetRoot, { withFileTypes: true })
  } catch {
    return { assetDir: path.basename(assetRoot), chapters }
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue
    const dir = path.join(assetRoot, entry.name)
    let names: string[]
    try {
      names = fs.readdirSync(dir)
    } catch {
      continue
    }

    const sources: Chapter['sources'] = {}
    let adhd: MarkdownSource | undefined
    for (const name of names) {
      if (name.startsWith('.')) continue
      const ext = path.extname(name).toLowerCase()
      const url = `${urlBase}/${encodeURIComponent(entry.name)}/${encodeURIComponent(name)}`

      if (ext === '.md') {
        const stem = path.basename(name, ext).toLowerCase()
        if (stem === 'adhd') {
          try {
            adhd = {
              path: url,
              minutes: readingMinutes(fs.readFileSync(path.join(dir, name), 'utf8')),
            }
          } catch {
            /* unreadable, skip */
          }
          continue
        }
        if (stem !== 'zh' && stem !== 'en') continue
        try {
          sources[stem] = {
            path: url,
            minutes: readingMinutes(fs.readFileSync(path.join(dir, name), 'utf8')),
          }
        } catch {
          delete sources[stem]
        }
      } else if (ext === '.pdf' && !sources.pdf) {
        try {
          sources.pdf = { path: url, bytes: fs.statSync(path.join(dir, name)).size }
        } catch {
          /* unreadable, skip */
        }
      }
    }

    if (!Object.keys(sources).length) continue

    const match = CHAPTER_RE.exec(entry.name)
    chapters.push({
      slug: entry.name,
      num: match?.[1] ?? '',
      order: match ? Number(match[1]) : Number.MAX_SAFE_INTEGER,
      title: prettifySlug(match?.[2] || entry.name),
      ...(adhd ? { adhd } : {}),
      sources,
    })
  }

  chapters.sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug))
  return { assetDir: path.basename(assetRoot), chapters }
}

function json(res: ServerResponse, body: unknown) {
  const payload = JSON.stringify(body)
  res.statusCode = 200
  res.setHeader('content-type', 'application/json; charset=utf-8')
  res.setHeader('cache-control', 'no-store')
  res.setHeader('content-length', Buffer.byteLength(payload))
  res.end(payload)
}

function fail(res: ServerResponse, status: number, message: string) {
  res.statusCode = status
  res.setHeader('content-type', 'text/plain; charset=utf-8')
  res.end(message)
}

function sendFile(res: ServerResponse, assetRoot: string, urlBase: string, req: IncomingMessage) {
  const raw = (req.url ?? '/').split('?')[0].split('#')[0]
  let pathname: string
  try {
    pathname = decodeURIComponent(raw)
  } catch {
    fail(res, 400, 'bad path')
    return
  }

  const file = path.resolve(assetRoot, pathname.slice(urlBase.length + 1))
  if (file !== assetRoot && !file.startsWith(assetRoot + path.sep)) {
    fail(res, 403, 'forbidden')
    return
  }

  let stat: fs.Stats
  try {
    stat = fs.statSync(file)
  } catch {
    fail(res, 404, 'not found')
    return
  }
  if (!stat.isFile()) {
    fail(res, 404, 'not found')
    return
  }

  res.statusCode = 200
  res.setHeader('content-type', MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream')
  res.setHeader('content-length', String(stat.size))
  res.setHeader('cache-control', 'no-cache')
  res.setHeader('accept-ranges', 'bytes')
  if (req.method === 'HEAD') {
    res.end()
    return
  }
  const stream = fs.createReadStream(file)
  stream.on('error', () => res.destroy())
  stream.pipe(res)
}

function createHandler(assetRoot: string, urlBase: string) {
  const apiPath = '/api/chapters.json'
  return (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next()
    const raw = (req.url ?? '/').split('?')[0].split('#')[0]
    let pathname: string
    try {
      pathname = decodeURIComponent(raw)
    } catch {
      return next()
    }
    if (pathname === apiPath) {
      json(res, scan(assetRoot, urlBase))
      return
    }
    if (pathname === urlBase || pathname.startsWith(urlBase + '/')) {
      sendFile(res, assetRoot, urlBase, req)
      return
    }
    next()
  }
}

export function assetCatalog(): Plugin {
  let projectRoot = process.cwd()
  let assetRoot = path.join(projectRoot, ASSET_DIR_CANDIDATES[0])
  let urlBase = '/' + ASSET_DIR_CANDIDATES[0]

  const refresh = () => {
    assetRoot = findAssetRoot(projectRoot)
    urlBase = '/' + path.basename(assetRoot)
  }

  return {
    name: 'bilingual-reader:asset-catalog',

    configResolved(config) {
      projectRoot = config.root
      refresh()
    },

    configureServer(server) {
      server.middlewares.use(createHandler(assetRoot, urlBase))
      // New chapters or translations should show up without restarting the dev server.
      server.watcher.add(assetRoot)
      const reload = (file: string) => {
        if (file.startsWith(assetRoot) && !file.includes(`${path.sep}node_modules${path.sep}`)) {
          server.ws.send({ type: 'full-reload' })
        }
      }
      server.watcher.on('add', reload)
      server.watcher.on('unlink', reload)
      server.watcher.on('addDir', reload)
      server.watcher.on('unlinkDir', reload)
    },

    configurePreviewServer(server) {
      server.middlewares.use(createHandler(assetRoot, urlBase))
    },

    /** `vite build` output stays self-contained: assets copied, catalog frozen. */
    writeBundle(options) {
      const outDir = path.resolve(projectRoot, options.dir ?? 'dist')
      if (fs.existsSync(assetRoot)) {
        fs.cpSync(assetRoot, path.join(outDir, path.basename(assetRoot)), {
          recursive: true,
          filter: (src) => path.basename(src) !== '.DS_Store',
        })
      }
      fs.mkdirSync(path.join(outDir, 'api'), { recursive: true })
      fs.writeFileSync(
        path.join(outDir, 'api', 'chapters.json'),
        JSON.stringify(scan(assetRoot, urlBase)),
      )
    },
  }
}
