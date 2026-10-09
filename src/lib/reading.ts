const CJK_RE = /[\u3400-\u9fff\uf900-\ufaff]/g

/** Minutes at ~420 CJK chars or ~230 latin words per minute, code stripped. */
export function readingMinutes(markdown: string): number {
  const body = markdown.replace(/```[\s\S]*?```/g, ' ').replace(/<[^>]*>/g, ' ')
  const cjk = body.match(CJK_RE)?.length ?? 0
  const latin = body.replace(CJK_RE, ' ').match(/[A-Za-z][A-Za-z'’-]*/g)?.length ?? 0
  return Math.max(1, Math.round(cjk / 420 + latin / 230))
}
