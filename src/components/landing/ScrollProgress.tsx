'use client'

import { motion, useScroll, useSpring } from 'framer-motion'

/**
 * Thin accent-gradient scroll-progress bar pinned to the very top of the
 * viewport. Scroll-linked transform (no autonomous animation), spring-smoothed.
 */
export function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 400, damping: 40, restDelta: 0.001 })

  return (
    <motion.div
      aria-hidden="true"
      className="fixed inset-x-0 top-0 z-[95] h-[2px] origin-left bg-gradient-to-r from-fora-accent via-fora-glow to-fora-accent"
      style={{ scaleX }}
    />
  )
}
