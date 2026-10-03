interface NoticeProps {
  title: string
  sub: string
}

/** Empty and failure states: say what happened and what to do next. */
export function Notice({ title, sub }: NoticeProps) {
  return (
    <div className="notice">
      <p className="notice-title">{title}</p>
      <p className="notice-sub">{sub}</p>
    </div>
  )
}
