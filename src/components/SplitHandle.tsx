import { Separator } from 'react-resizable-panels'

interface SplitHandleProps {
  ratio: number
}

/**
 * The divider, drawn as the dashed boundary line of an address-space diagram.
 * Resizing, keyboard support and the ARIA separator state come from the panels
 * library; this only supplies the chrome.
 */
export function SplitHandle({ ratio }: SplitHandleProps) {
  return (
    <Separator className="gutter" style={{ flexBasis: 'var(--gutter-w)' }}>
      <span className="gutter-read">{Math.round(ratio)}%</span>
      <span className="gutter-grip" aria-hidden="true" />
    </Separator>
  )
}
