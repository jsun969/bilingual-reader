import { useEffect, useState } from 'react'
import type { Catalog } from '../types'
import { fetchCatalog } from '../lib/catalog'

type CatalogStatus = 'loading' | 'ready' | 'error'

export interface CatalogResult {
  catalog: Catalog
  status: CatalogStatus
  detail: string
}

const EMPTY: Catalog = { assetDir: 'asset', chapters: [] }

/** Reads the chapter list the dev/preview server derives from the asset folder. */
export function useCatalog(): CatalogResult {
  const [result, setResult] = useState<CatalogResult>(() => ({
    catalog: EMPTY,
    status: 'loading',
    detail: '',
  }))

  useEffect(() => {
    const controller = new AbortController()
    fetchCatalog(controller.signal)
      .then((catalog) => {
        setResult({ catalog, status: 'ready', detail: '' })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setResult({ catalog: EMPTY, status: 'error', detail: String(error) })
      })
    return () => controller.abort()
  }, [])

  return result
}
