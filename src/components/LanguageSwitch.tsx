import { COPY } from '../copy'
import { LANGS } from '../lib/config'
import type { Chapter, Lang, Side } from '../types'

interface LanguageSwitchProps {
  side: Side
  current: Lang
  sources: Chapter['sources'] | undefined
  onChange: (lang: Lang) => void
}

export function LanguageSwitch({ side, current, sources, onChange }: LanguageSwitchProps) {
  return (
    <div className="switch" role="group" aria-label={COPY.langSwitchLabel(side)}>
      {LANGS.map((lang) => {
        const available = Boolean(sources?.[lang])
        return (
          <button
            key={lang}
            className="sw"
            type="button"
            aria-pressed={current === lang}
            disabled={!available}
            title={available ? undefined : COPY.missingSource(lang)}
            onClick={() => onChange(lang)}
          >
            {COPY.langLabel(lang)}
          </button>
        )
      })}
    </div>
  )
}
