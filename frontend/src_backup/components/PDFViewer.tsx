import { useCallback, useEffect, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'

// Configure PDF.js worker - use unpkg CDN (more reliable than local file)
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
}

const RESIZE_DEBOUNCE_MS = 200

interface PDFViewerProps {
  blob: Blob
  documentName: string
  allowPrint: boolean
  allowDownload: boolean
  /** Called after a page has been rendered (e.g. after resize) for blur-removal. */
  onRenderComplete?: () => void
  /** Height in pixels to reserve at bottom for footer watermark (reduces page size to prevent overlap) */
  footerHeight?: number
}

/**
 * PDF viewer using PDF.js with responsive fit-to-window scaling.
 * Scale is derived from container size (ResizeObserver + debounce); no fixed px width.
 */
export default function PDFViewer({
  blob,
  allowPrint,
  onRenderComplete,
  footerHeight = 0
}: PDFViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRefs = useRef<Record<number, HTMLCanvasElement | null>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [totalPages, setTotalPages] = useState(0)
  const [computedScale, setComputedScale] = useState(1)
  const [userZoomFactor, setUserZoomFactor] = useState(1)
  const pdfDocRef = useRef<any>(null)
  const firstPageRef = useRef<any>(null)
  const resizeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const renderTasksRef = useRef<Record<number, any>>({})
  const renderCycleRef = useRef(0)
  const A4_TARGET_WIDTH_PX = 794
  const FULLSCREEN_TARGET_WIDTH_PX = 1080

  const baseScale = computedScale
  const scale = baseScale * userZoomFactor

  const renderAllPages = useCallback(
    async (currentScale: number) => {
      if (!pdfDocRef.current || totalPages <= 0) return
      const currentCycle = ++renderCycleRef.current

      try {
        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
          if (currentCycle !== renderCycleRef.current) return
          const page = await pdfDocRef.current.getPage(pageNum)
          const canvas = canvasRefs.current[pageNum]
          if (!canvas) continue
          const context = canvas.getContext('2d')
          if (!context) continue

          const viewport = page.getViewport({ scale: currentScale })
          canvas.height = viewport.height
          canvas.width = viewport.width
          canvas.style.width = `${viewport.width}px`
          canvas.style.height = `${viewport.height}px`

          // Cancel previous render task for this canvas before starting a new one.
          const prevTask = renderTasksRef.current[pageNum]
          if (prevTask) {
            try {
              prevTask.cancel()
            } catch {
              // no-op
            }
          }

          const renderTask = page.render({
            canvasContext: context,
            viewport
          })
          renderTasksRef.current[pageNum] = renderTask

          try {
            await renderTask.promise
          } catch (err: any) {
            if (err?.name === 'RenderingCancelledException') {
              return
            }
            throw err
          } finally {
            if (renderTasksRef.current[pageNum] === renderTask) {
              delete renderTasksRef.current[pageNum]
            }
          }
        }
        if (currentCycle === renderCycleRef.current) {
          onRenderComplete?.()
        }
      } catch (err: any) {
        if (err?.name === 'RenderingCancelledException') return
        console.error('Error rendering page:', err)
        setError(err.message || 'Failed to render page')
      }
    },
    [onRenderComplete, totalPages]
  )

  const computeScaleFromContainer = useCallback(() => {
    const container = containerRef.current
    const page = firstPageRef.current
    if (!container || !page) return

    const containerWidth = container.clientWidth
    if (containerWidth <= 0) return

    const baseViewport = page.getViewport({ scale: 1 })
    const pageWidth = baseViewport.width

    // Keep A4-like width normally; allow larger adaptive width in fullscreen.
    const usableWidth = Math.max(320, containerWidth - 40)
    const isFullscreenMode = !!document.fullscreenElement
    const targetCap = isFullscreenMode ? FULLSCREEN_TARGET_WIDTH_PX : A4_TARGET_WIDTH_PX
    const targetWidth = Math.min(targetCap, usableWidth)
    const newScale = Math.max(0.5, Math.min(targetWidth / pageWidth, 3))
    setComputedScale(newScale)
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadPDF = async () => {
      try {
        // Invalidate/cancel any in-flight renders from previous document blob.
        renderCycleRef.current++
        for (const task of Object.values(renderTasksRef.current)) {
          try {
            task?.cancel?.()
          } catch {
            // no-op
          }
        }
        renderTasksRef.current = {}

        setLoading(true)
        setError(null)
        const arrayBuffer = await blob.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
        if (!isMounted) return
        pdfDocRef.current = pdf
        setTotalPages(pdf.numPages)
        const firstPage = await pdf.getPage(1)
        firstPageRef.current = firstPage
        if (!isMounted) return
        setLoading(false)
      } catch (err: any) {
        console.error('Error loading PDF:', err)
        if (isMounted) {
          setError(err.message || 'Failed to load PDF')
          setLoading(false)
        }
      }
    }

    loadPDF()
    return () => {
      isMounted = false
      renderCycleRef.current++
      for (const task of Object.values(renderTasksRef.current)) {
        try {
          task?.cancel?.()
        } catch {
          // no-op
        }
      }
      renderTasksRef.current = {}
    }
  }, [blob])

  useEffect(() => {
    if (loading || totalPages === 0 || !firstPageRef.current) return
    computeScaleFromContainer()
  }, [loading, totalPages, computeScaleFromContainer])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scheduleResize = () => {
      if (resizeTimeoutRef.current) clearTimeout(resizeTimeoutRef.current)
      resizeTimeoutRef.current = setTimeout(() => {
        resizeTimeoutRef.current = null
        computeScaleFromContainer()
      }, RESIZE_DEBOUNCE_MS)
    }

    const ro = new ResizeObserver(() => scheduleResize())
    ro.observe(container)

    return () => {
      ro.disconnect()
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current)
        resizeTimeoutRef.current = null
      }
    }
  }, [computeScaleFromContainer])

  useEffect(() => {
    const handleFullscreenChange = () => computeScaleFromContainer()
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [computeScaleFromContainer])

  useEffect(() => {
    if (pdfDocRef.current && totalPages > 0) {
      renderAllPages(scale)
    }
  }, [scale, totalPages, renderAllPages])

  const zoomIn = () => {
    setUserZoomFactor(prev => Math.min(prev + 0.25, 3))
  }

  const zoomOut = () => {
    setUserZoomFactor(prev => Math.max(prev - 0.25, 0.5))
  }

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      return false
    }
    const container = containerRef.current
    if (container) {
      container.addEventListener('contextmenu', handleContextMenu)
      return () => container.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [])

  useEffect(() => {
    if (!allowPrint) {
      const handleBeforePrint = (e: Event) => {
        e.preventDefault()
        alert('Printing is disabled')
        return false
      }
      const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
          e.preventDefault()
          alert('Printing is disabled')
          return false
        }
      }
      window.addEventListener('beforeprint', handleBeforePrint as any)
      window.addEventListener('keydown', handleKeyDown)
      return () => {
        window.removeEventListener('beforeprint', handleBeforePrint as any)
        window.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [allowPrint])

  if (loading) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', fontSize: '18px', color: '#666' }}>
        <div style={{ marginBottom: '16px' }}>⏳</div>
        Loading PDF...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '60px', textAlign: 'center', fontSize: '16px', color: '#f44336' }}>
        <div style={{ marginBottom: '16px' }}>⚠️</div>
        Error: {error}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="pdf-viewer-container"
      style={{
        position: 'relative',
        width: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        background: '#525252',
        padding: '20px',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        MozUserSelect: 'none',
        msUserSelect: 'none',
        WebkitTouchCallout: 'none',
        touchAction: 'none'
      }}
      onContextMenu={e => {
        e.preventDefault()
        e.stopPropagation()
        return false
      }}
      onDragStart={e => {
        e.preventDefault()
        e.stopPropagation()
        return false
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '16px',
          padding: '12px',
          background: '#424242',
          borderRadius: '8px',
          color: 'white'
        }}
      >
        <span style={{ minWidth: '160px', textAlign: 'center' }}>
          Continuous Scroll • {totalPages} page(s)
        </span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={zoomOut}
            style={{
              padding: '8px 12px',
              background: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            −
          </button>
          <span style={{ minWidth: '60px', textAlign: 'center' }}>{Math.round(scale * 100)}%</span>
          <button
            onClick={zoomIn}
            style={{
              padding: '8px 12px',
              background: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            +
          </button>
        </div>
      </div>

      <div
        className="pdf-preview-wrapper"
        style={{
          display: 'flex',
          justifyContent: 'flex-start',
          alignItems: 'flex-start',
          width: '100%',
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          background: '#525252',
          paddingBottom: footerHeight ? `${footerHeight}px` : '0'
        }}
      >
        <div
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
            <canvas
              key={pageNum}
              ref={(el) => {
                canvasRefs.current[pageNum] = el
              }}
              className="document-page"
              style={{
                display: 'block',
                maxWidth: '100%',
                height: 'auto',
                boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
                background: 'white',
                userSelect: 'none',
                WebkitUserSelect: 'none',
                MozUserSelect: 'none',
                msUserSelect: 'none',
                pointerEvents: 'auto'
              }}
              onContextMenu={e => {
                e.preventDefault()
                e.stopPropagation()
                return false
              }}
              onDragStart={e => {
                e.preventDefault()
                e.stopPropagation()
                return false
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
