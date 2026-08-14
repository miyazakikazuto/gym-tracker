import { useEffect, useRef, type ReactNode } from 'react'

// Modal bottom-sheet dengan aksesibilitas:
// - Escape untuk menutup
// - Focus trap (Tab / Shift+Tab tidak keluar dari modal)
// - Fokus otomatis ke elemen pertama saat dibuka
// - Fokus dikembalikan ke elemen sebelumnya saat ditutup
// - role="dialog" + aria-modal + aria-label untuk screen reader
export default function Modal({
  onClose,
  label,
  children,
}: {
  onClose: () => void
  label: string
  children: ReactNode
}) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const prevFocus = useRef<HTMLElement | null>(null)
  // onClose dipakai lewat ref agar effect cukup dijalankan sekali (StrictMode-safe)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    prevFocus.current = document.activeElement as HTMLElement | null
    const overlay = overlayRef.current
    const getFocusables = () =>
      Array.from(
        overlay?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      )

    // Fokus elemen pertama di dalam modal
    const first = getFocusables()[0]
    first?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const els = getFocusables()
      if (els.length === 0) return
      const active = document.activeElement as HTMLElement | null
      const inside = overlay?.contains(active) ?? false
      if (!inside) {
        e.preventDefault()
        els[0].focus()
        return
      }
      const firstEl = els[0]
      const lastEl = els[els.length - 1]
      if (e.shiftKey && active === firstEl) {
        e.preventDefault()
        lastEl.focus()
      } else if (!e.shiftKey && active === lastEl) {
        e.preventDefault()
        firstEl.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      prevFocus.current?.focus?.()
    }
  }, [])

  return (
    <div
      className="modal-overlay"
      ref={overlayRef}
      onClick={() => onCloseRef.current()}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}
