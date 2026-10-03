import { useEffect, useState } from 'react'
import type { RefObject } from 'react'

interface ScrollSpyOptions {
  scrollRef: RefObject<HTMLElement | null>
  docRef: RefObject<HTMLElement | null>
  ids: string[]
  enabled: boolean
}

/** Id of the heading currently at the top of the pane, for the outline. */
export function useScrollSpy(options: ScrollSpyOptions): string {
  const { scrollRef, docRef, ids, enabled } = options
  const [activeId, setActiveId] = useState('')

  useEffect(() => {
    const scroll = scrollRef.current
    const doc = docRef.current
    if (!enabled || !scroll || !doc || ids.length === 0) {
      setActiveId('')
      return
    }

    const headings = ids
      .map((id) => doc.querySelector<HTMLElement>(`#${CSS.escape(id)}`))
      .filter((heading): heading is HTMLElement => heading !== null)

    let queued = false
    const spy = () => {
      queued = false
      const line = scroll.getBoundingClientRect().top + 96
      let current = headings[0].id
      for (const heading of headings) {
        if (heading.getBoundingClientRect().top > line) break
        current = heading.id
      }
      setActiveId(current)
    }

    spy()
    const onScroll = () => {
      if (queued) return
      queued = true
      requestAnimationFrame(spy)
    }
    scroll.addEventListener('scroll', onScroll, { passive: true })
    return () => scroll.removeEventListener('scroll', onScroll)
  }, [scrollRef, docRef, ids, enabled])

  return activeId
}
