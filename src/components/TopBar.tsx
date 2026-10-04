import { COPY } from '../copy'
import type { Chapter } from '../types'

interface TopBarProps {
  chapter: Chapter | undefined
  navOpen: boolean
  onToggleNav: () => void
}

export function TopBar({ chapter, navOpen, onToggleNav }: TopBarProps) {
  return (
    <header className="topbar grid-bg">
      <button
        className="tool-btn nav-toggle"
        type="button"
        aria-expanded={navOpen}
        onClick={onToggleNav}
      >
        {COPY.navToggle}
      </button>
      <p className="brand">
        <span className="brand-mark">{COPY.appName}</span>
        <span className="brand-sub">{COPY.appSubtitle}</span>
      </p>
      <p className="current" aria-live="polite">
        {chapter ? (
          <>
            <span className="current-num">{chapter.num ? `#${chapter.num}` : '#—'}</span>
            <span className="current-sep">·</span>
            {chapter.title}
          </>
        ) : null}
      </p>
    </header>
  )
}
