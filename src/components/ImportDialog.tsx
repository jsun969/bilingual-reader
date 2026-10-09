import { useCallback, useEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import { LuFolderOpen } from 'react-icons/lu'
import { COPY } from '../copy'
import { ImportError, droppedDirectory, pickDirectory, pickerSupported, scanChapter } from '../lib/fs'
import { useLibraryStore } from '../lib/library'
import { parseFolderName } from '../lib/naming'
import { useViewerStore } from '../lib/store'
import type { Chapter, ChapterFiles } from '../types'

export type DialogState =
  | { mode: 'import' }
  | { mode: 'rename'; id: string }
  | { mode: 'relink'; id: string }

interface ImportDialogProps {
  mode: DialogState['mode']
  /** The chapter being renamed or relinked; absent when importing a new one. */
  chapter?: Chapter
  onClose: () => void
}

const TITLES: Record<DialogState['mode'], string> = {
  import: COPY.dialogImportTitle,
  rename: COPY.dialogRenameTitle,
  relink: COPY.dialogRelinkTitle,
}

/** The files that were recognised, in the order the reader thinks of them. */
function describeFiles(files: ChapterFiles): string {
  return [
    files.sources.zh?.name,
    files.sources.en?.name,
    files.adhd?.name,
    files.sources.pdf?.name,
  ]
    .filter(Boolean)
    .join('、')
}

/**
 * One dialog for every chapter edit: import a new folder (number + title typed
 * by hand, folder dropped or picked), rename an existing chapter, or point a
 * chapter whose folder moved at the folder it moved to.
 */
export function ImportDialog({ mode, chapter, onClose }: ImportDialogProps) {
  const importChapter = useLibraryStore((state) => state.importChapter)
  const renameChapter = useLibraryStore((state) => state.renameChapter)
  const relinkChapter = useLibraryStore((state) => state.relinkChapter)
  const openChapter = useViewerStore((state) => state.openChapter)

  const needsFolder = mode !== 'rename'
  const supported = pickerSupported()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [num, setNum] = useState(chapter?.num ?? '')
  const [title, setTitle] = useState(chapter?.title ?? '')
  /** Once a field was typed in, picking another folder must not overwrite it. */
  const touched = useRef({ num: false, title: false })
  const [dir, setDir] = useState<FileSystemDirectoryHandle>()
  const [files, setFiles] = useState<ChapterFiles>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)

  // Native modal: focus trap and Esc-to-close come for free.
  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  const acceptFolder = useCallback(
    async (handle: FileSystemDirectoryHandle) => {
      setBusy(true)
      setError('')
      try {
        const scanned = await scanChapter(handle)
        setDir(handle)
        setFiles(scanned)
        // Importing starts from blank fields, so they can be filled from the
        // folder name; renaming and relinking keep whatever the reader typed.
        if (mode === 'import') {
          const parsed = parseFolderName(handle.name)
          if (!touched.current.num) setNum(parsed.num)
          if (!touched.current.title) setTitle(parsed.title)
        }
      } catch (failure) {
        setDir(undefined)
        setFiles(undefined)
        setError(
          failure instanceof ImportError
            ? COPY.dialogNoFiles
            : COPY.folderFailed(failure instanceof Error ? failure.message : String(failure)),
        )
      } finally {
        setBusy(false)
      }
    },
    [mode],
  )

  const choose = async () => {
    try {
      const handle = await pickDirectory()
      if (handle) await acceptFolder(handle)
    } catch (failure) {
      setError(COPY.folderFailed(failure instanceof Error ? failure.message : String(failure)))
    }
  }

  const onDrop = async (event: DragEvent) => {
    event.preventDefault()
    setDragging(false)
    const item = [...event.dataTransfer.items].find((entry) => entry.getAsFileSystemHandle)
    if (!item) {
      setError(COPY.dialogDropUnsupported)
      return
    }
    try {
      const handle = await droppedDirectory(item)
      if (!handle) {
        setError(COPY.dialogDropUnsupported)
        return
      }
      await acceptFolder(handle)
    } catch (failure) {
      setError(COPY.folderFailed(failure instanceof Error ? failure.message : String(failure)))
    }
  }

  const submit = async () => {
    if (mode !== 'import' && !chapter) {
      onClose()
      return
    }
    const name = title.trim()
    if (!name) {
      setError(COPY.nameRequired)
      return
    }
    if (needsFolder && (!dir || !files)) {
      setError(COPY.pickRequired)
      return
    }
    setBusy(true)
    setError('')
    try {
      if (mode === 'import') {
        const created = await importChapter(dir!, num.trim(), name, files!)
        openChapter(created.id)
      } else if (mode === 'rename') {
        renameChapter(chapter!.id, num.trim(), name)
      } else {
        await relinkChapter(chapter!.id, dir!, files!)
        openChapter(chapter!.id)
      }
      onClose()
    } catch (failure) {
      setError(COPY.folderFailed(failure instanceof Error ? failure.message : String(failure)))
      setBusy(false)
    }
  }

  return (
    <dialog className="dialog" ref={dialogRef} aria-labelledby="dialog-title" onClose={onClose}>
      <form
        className="dialog-card"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <p className="dialog-title" id="dialog-title">
          {TITLES[mode]}
        </p>

        {needsFolder ? (
          <>
            <div className="dialog-format">
              <p className="dialog-format-title">{COPY.dialogFormatTitle}</p>
              <ul>
                {COPY.dialogFormatLines.map((parts, index) => (
                  <li key={index}>
                    {parts.map((part, i) =>
                      typeof part === 'string' ? (
                        part
                      ) : (
                        <a key={i} href={part.href} target="_blank" rel="noreferrer">
                          {part.label}
                        </a>
                      ),
                    )}
                  </li>
                ))}
              </ul>
              <p className="dialog-format-tip">{COPY.dialogFormatTip}</p>
            </div>

            <button
              className="dropzone"
              data-drag={dragging ? 'true' : 'false'}
              type="button"
              disabled={busy || !supported}
              onClick={choose}
              onDragOver={(event) => {
                event.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <LuFolderOpen />
              <span className="dropzone-main">{COPY.dialogPick}</span>
              <span className="dropzone-sub">
                {supported ? COPY.dialogDrop : COPY.unsupportedSub}
              </span>
            </button>

            {dir ? (
              <p className="dialog-picked">
                {COPY.dialogPicked(dir.name)}
                {files ? <span> · {COPY.dialogDetected(describeFiles(files))}</span> : null}
              </p>
            ) : null}
          </>
        ) : null}

        <label className="field">
          <span className="field-label">{COPY.numLabel}</span>
          <input
            className="field-input"
            value={num}
            placeholder={COPY.numPlaceholder}
            onChange={(event) => {
              touched.current.num = true
              setNum(event.target.value)
            }}
          />
        </label>
        <label className="field">
          <span className="field-label">{COPY.nameLabel}</span>
          <input
            className="field-input"
            value={title}
            placeholder={COPY.namePlaceholder}
            autoFocus
            onChange={(event) => {
              touched.current.title = true
              setTitle(event.target.value)
            }}
          />
        </label>
        <p className="dialog-hint">{COPY.numHint}</p>

        {error ? <p className="dialog-error">{error}</p> : null}

        <div className="dialog-actions">
          <button className="tool-btn" type="button" onClick={onClose}>
            {COPY.cancel}
          </button>
          <button className="tool-btn dialog-confirm" type="submit" disabled={busy}>
            {mode === 'rename' ? COPY.confirmSave : COPY.confirmImport}
          </button>
        </div>
      </form>
    </dialog>
  )
}
