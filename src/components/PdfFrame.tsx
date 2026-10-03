interface PdfFrameProps {
  path: string
}

/** The original chapter, handed to the browser's own PDF viewer. */
export function PdfFrame({ path }: PdfFrameProps) {
  return (
    <iframe
      className="pdf-view"
      title="章节原件 PDF"
      src={`${path}#view=FitH`}
      loading="lazy"
    />
  )
}
