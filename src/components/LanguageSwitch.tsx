import { COPY } from '../copy'
import { LANGS } from '../lib/config'
import type { Chapter, Lang } from '../types'

interface LanguageSwitchProps {
  current: Lang
  sources: Chapter['sources'] | undefined
  onChange: (lang: Lang) => void
}

export function LanguageSwitch({ current, sources, onChange }: LanguageSwitchProps) {
  return (
    <div className="switch" role="group" aria-label={COPY.langSwitchLabel}>
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
