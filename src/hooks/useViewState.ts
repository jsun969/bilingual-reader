import { useCallback, useEffect, useState } from 'react'
import type { ViewState } from '../types'
import { readViewState, writeViewState } from '../lib/config'

/** View state that survives a reload: chapter, both pane languages, split ratio. */
export function useViewState(): [ViewState, (patch: Partial<ViewState>) => void] {
  const [view, setView] = useState<ViewState>(readViewState)

  useEffect(() => {
    writeViewState(view)
  }, [view])

  const update = useCallback((patch: Partial<ViewState>) => {
    setView((previous) => ({ ...previous, ...patch }))
  }, [])

  return [view, update]
}
