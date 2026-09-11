'use client'

import { useEffect, useRef } from 'react'
import { useInView, useMotionValue, useReducedMotion, useSpring } from 'framer-motion'

interface AnimatedCounterProps {
  /** Final value to count up to. */
  value: number
  /** Digits after the decimal point (e.g. 1 for 99.9). */
  decimals?: number
  /** Count-up duration in seconds. */
  duration?: number
  className?: string
}

/**
 * Scroll-triggered animated number: starts at 0 and springs up to `value`
 * the first time it enters the viewport. Respects prefers-reduced-motion
 * (renders the final value immediately). SSR-safe (renders "0" on server).
 */
export function AnimatedCounter({ value, decimals = 0, duration = 1.9, className }: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-64px' })
  const reduce = useReducedMotion()
  const motionValue = useMotionValue(0)
  const spring = useSpring(motionValue, { duration: duration * 1000, bounce: 0 })

  useEffect(() => {
    if (!inView) return
    if (reduce) {
      motionValue.jump(value)
      return
    }
    motionValue.set(value)
  }, [inView, reduce, value, motionValue])

  useEffect(() => {
    const formatter = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
    return spring.on('change', (latest) => {
      if (ref.current) {
        ref.current.textContent = formatter.format(latest)
      }
    })
  }, [spring, decimals])

  return (
    <span ref={ref} className={className}>
      0
    </span>
  )
}
