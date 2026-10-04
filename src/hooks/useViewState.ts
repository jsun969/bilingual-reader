import { useCallback, useEffect, useState } from 'react'
import type { ViewState } from '../types'
import { readViewState, writeViewState } from '../lib/config'

type ViewPatch = Partial<ViewState> | ((previous: ViewState) => Partial<ViewState>)

/** View state that survives a reload: the chapter and the window tree. */
export function useViewState(): [ViewState, (patch: ViewPatch) => void] {
  const [view, setView] = useState<ViewState>(readViewState)

  useEffect(() => {
    writeViewState(view)
  }, [view])

  const update = useCallback((patch: ViewPatch) => {
    setView((previous) => {
      const changes = typeof patch === 'function' ? patch(previous) : patch
      const keys = Object.keys(changes) as (keyof ViewState)[]
      // Dragging a divider reports the same ratio on every frame, so a no-op
      // patch must not re-render (or re-save) the whole tree.
      if (keys.every((key) => previous[key] === changes[key])) return previous
      return { ...previous, ...changes }
    })
  }, [])

  return [view, update]
}
