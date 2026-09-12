'use client'

import { motion, useReducedMotion } from 'framer-motion'
import type { ReactNode } from 'react'

interface FadeInProps {
  children: ReactNode
  /** Stagger delay in seconds. */
  delay?: number
  /** Vertical offset (px) the content rises from. */
  y?: number
  className?: string
}

/**
 * Scroll-reveal wrapper: fades + rises into view once, respecting
 * prefers-reduced-motion (renders statically when reduced).
 */
export function FadeIn({ children, delay = 0, y = 28, className }: FadeInProps) {
  const reduce = useReducedMotion()

  if (reduce) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-72px' }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}
