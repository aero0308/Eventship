'use client'

import { useEffect, useRef } from 'react'

const INTERACTIVE_SELECTOR =
  'a, button, [role="button"], input, select, textarea, label, summary, [data-cursor]'

/**
 * Custom cursor dot — a small inverted circle (mix-blend-difference) that
 * trails the pointer with a soft lerp and scales up over interactive
 * elements.
 *
 * State-free by design: the element is always mounted (parked off-screen),
 * the follow loop only starts on fine pointers without reduced-motion, and
 * CSS hides the dot entirely on coarse pointers / reduced motion.
 */
export function CustomCursor() {
  const dotRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const dot = dotRef.current
    if (!dot) return

    const fine = window.matchMedia('(pointer: fine)')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!fine.matches || reduced.matches) return

    let raf = 0
    const pos = { x: -100, y: -100 }
    const target = { x: -100, y: -100 }
    let scale = 1
    let targetScale = 1

    const onMove = (e: MouseEvent) => {
      target.x = e.clientX
      target.y = e.clientY
      const el = e.target instanceof Element ? e.target : null
      targetScale = el?.closest(INTERACTIVE_SELECTOR) ? 3.4 : 1
    }
    const onLeave = () => {
      target.x = -100
      target.y = -100
      targetScale = 1
    }

    const tick = () => {
      pos.x += (target.x - pos.x) * 0.18
      pos.y += (target.y - pos.y) * 0.18
      scale += (targetScale - scale) * 0.18
      dot.style.transform = `translate(${pos.x - 6}px, ${pos.y - 6}px) scale(${scale})`
      raf = requestAnimationFrame(tick)
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    document.documentElement.addEventListener('mouseleave', onLeave)
    raf = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('mousemove', onMove)
      document.documentElement.removeEventListener('mouseleave', onLeave)
      cancelAnimationFrame(raf)
    }
  }, [])

  return <div ref={dotRef} aria-hidden="true" className="evos-cursor" style={{ transform: 'translate(-100px, -100px)' }} />
}
