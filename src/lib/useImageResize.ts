'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * Image resize helper for contentEditable editors.
 * - Click an <img> inside the editor → shows corner handles to drag-resize.
 * - Exposes scaleSelected(factor) to shrink/grow the currently selected image.
 *
 * contentEditable does not provide consistent resize handles across browsers,
 * so we render our own overlay positioned over the selected image.
 */
export function useImageResize(editorRef: React.RefObject<HTMLDivElement | null>) {
  const [selected, setSelected] = useState<HTMLImageElement | null>(null)
  const [box, setBox] = useState<{ top: number; left: number; width: number; height: number } | null>(null)
  const dragRef = useRef<{ startX: number; startW: number; ratio: number } | null>(null)

  // Recompute the overlay position from the selected image
  const reposition = useCallback(() => {
    const editor = editorRef.current
    if (!selected || !editor) { setBox(null); return }
    const imgRect = selected.getBoundingClientRect()
    const edRect = editor.getBoundingClientRect()
    // Overlay lives in a non-scrolling wrapper that overlaps the editor viewport,
    // so position is relative to the editor's visible box (no scrollTop offset).
    setBox({
      top: imgRect.top - edRect.top,
      left: imgRect.left - edRect.left,
      width: imgRect.width,
      height: imgRect.height,
    })
  }, [selected, editorRef])

  // Select image on click inside the editor
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (t && t.tagName === 'IMG') {
        setSelected(t as HTMLImageElement)
      } else {
        setSelected(null)
      }
    }
    editor.addEventListener('click', onClick)
    return () => editor.removeEventListener('click', onClick)
  }, [editorRef])

  // Keep overlay in sync while selected (scroll/resize)
  useEffect(() => {
    if (!selected) { setBox(null); return }
    reposition()
    const editor = editorRef.current
    const onScroll = () => reposition()
    editor?.addEventListener('scroll', onScroll)
    window.addEventListener('resize', onScroll)
    return () => {
      editor?.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [selected, reposition, editorRef])

  // Drag one of the corner handles
  const startDrag = useCallback((e: React.MouseEvent) => {
    if (!selected) return
    e.preventDefault()
    const rect = selected.getBoundingClientRect()
    dragRef.current = { startX: e.clientX, startW: rect.width, ratio: rect.height / rect.width }

    const onMove = (ev: MouseEvent) => {
      const d = dragRef.current
      if (!d || !selected) return
      const newW = Math.max(40, d.startW + (ev.clientX - d.startX))
      selected.style.width = `${Math.round(newW)}px`
      selected.style.height = 'auto'
      selected.removeAttribute('width')
      selected.removeAttribute('height')
      reposition()
    }
    const onUp = () => {
      dragRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [selected, reposition])

  // Scale the selected image by a factor (e.g. 0.5 = shrink to half)
  const scaleSelected = useCallback((factor: number) => {
    if (!selected) return false
    const w = selected.getBoundingClientRect().width
    selected.style.width = `${Math.max(40, Math.round(w * factor))}px`
    selected.style.height = 'auto'
    selected.removeAttribute('width')
    selected.removeAttribute('height')
    reposition()
    return true
  }, [selected, reposition])

  const clearSelection = useCallback(() => setSelected(null), [])

  return { selected, box, startDrag, scaleSelected, clearSelection, reposition }
}
