import type { Ref } from 'react'
import { LuExternalLink } from 'react-icons/lu'
import { ADHD_SKILL_URL, COPY } from '../copy'
import type { ChapterDoc } from '../types'

interface AdhdPanelProps {
  doc: ChapterDoc
  /** Kept mounted while the chapter has one, and slid in and out from the bottom. */
  open: boolean
  /** Remounts the body when the chapter changes, replaying its entry. */
  docKey: string
  /** The panel itself: nothing else watches presses around it. */
  ref?: Ref<HTMLElement>
}

/**
 * The chapter's condensed rendition, floating over the bottom of the pane.
 *
 * Unlike the outline it ignores presses outside itself: only its own button
 * puts it away, so the condensed text can be read while the chapter behind it
 * is still being clicked and scrolled. It carries its own scrollbar.
 */
export function AdhdPanel({ doc, open, docKey, ref }: AdhdPanelProps) {
  return (
    <aside className="adhd" data-open={open} ref={ref}>
      <div className="adhd-head">
        <span className="adhd-title">{COPY.adhdTitle}</span>
        {/* The file is never generated here: point at the skill that writes it. */}
        <a
          className="adhd-source"
          href={ADHD_SKILL_URL}
          target="_blank"
          rel="noreferrer"
          title={COPY.adhdSourceTitle}
        >
          {COPY.adhdSource}
          <LuExternalLink />
        </a>
      </div>
      <div className="adhd-body">
        {doc.status === 'ready' ? (
          <article
            className="adhd-doc"
            key={docKey}
            dangerouslySetInnerHTML={{ __html: doc.html }}
          />
        ) : doc.status === 'error' ? (
          <p className="adhd-note">{`${COPY.loadFailedTitle} ${doc.detail}`}</p>
        ) : (
          <p className="adhd-note">{COPY.loading}</p>
        )}
      </div>
    </aside>
  )
}
