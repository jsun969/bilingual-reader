export interface ParsedFolderName {
  /** The first number in the folder name, exactly as written; '' when there is none. */
  num: string
  /** What is left after the digits, separators turned into spaces, capitalised. */
  title: string
}

/**
 * Guesses a chapter number and title from a folder name, so the import dialog
 * has something to prefill: `23-xxx` → `23` / `Xxx`,
 * `23-18-alkdjf29` → `23` / `Alkdjf`, `chapter08-Multi-level-Feedback` →
 * `08` / `Chapter Multi Level Feedback`. Only the first letter of a word is
 * touched, so `VM` and `TLS` survive.
 */
export function parseFolderName(folder: string): ParsedFolderName {
  const num = /\d+/.exec(folder)?.[0] ?? ''
  const title = folder
    .replace(/\d+/g, '')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
  return { num, title }
}
