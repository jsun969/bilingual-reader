interface PdfFrameProps {
  path: string
}

/** The original chapter, handed to the browser's own PDF viewer. */
export function PdfFrame({ path }: PdfFrameProps) {
  return (
    <iframe
      className="pdf-view"
      title="本章的 PDF 原件"
      src={`${path}#view=FitH`}
      loading="lazy"
    />
  )
}
