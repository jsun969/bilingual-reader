interface FatalScreenProps {
  title: string
  sub: string
  detail: string
}

/** Shown when there is nothing to read at all, e.g. the asset folder is missing. */
export function FatalScreen({ title, sub, detail }: FatalScreenProps) {
  return (
    <div className="fatal grid-bg">
      <p className="notice-title">{title}</p>
      <p className="notice-sub">{sub}</p>
      <p className="fatal-code">{detail}</p>
    </div>
  )
}
