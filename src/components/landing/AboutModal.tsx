'use client'

import { useEffect, useRef, useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { AnimatePresence, motion, useReducedMotion, type Variants } from 'framer-motion'
import { ArrowRight, ArrowUpRight, Github, Linkedin, Mail, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { aboutContent } from './aboutContent'

interface AboutModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const SOCIAL_LINKS = [
  { label: 'GitHub', href: aboutContent.social.github, icon: Github, external: true },
  { label: 'LinkedIn', href: aboutContent.social.linkedin, icon: Linkedin, external: true },
  { label: 'Email', href: `mailto:${aboutContent.social.email}`, icon: Mail, external: false },
] as const

/** Shared classes for the two flagship actions. */
const ACTION_BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background'

/**
 * Personal-brand "About the developer" dialog, opened from the landing
 * footer. Dark-only (matches the landing), violet accent, framer-motion
 * fade + slide-up with staggered sections.
 *
 * Radix portals mount at <body> — outside the landing's `.fora-root`
 * scope and possibly outside the app's dark theme — so the content box
 * carries the `.fora-modal` scope (globals.css) that remaps the shadcn
 * tokens onto the landing's dark palette. All colors below therefore go
 * through tokens (bg-background, text-foreground, …) or alpha utilities.
 */
export function AboutModal({ open, onOpenChange }: AboutModalProps) {
  const reduce = useReducedMotion() ?? false
  const [photoFailed, setPhotoFailed] = useState(false)

  /*
   * Radix's built-in close-focus restores to <DialogTrigger>'s ref — but our
   * triggers are plain footer buttons, so triggerRef is null and focus would
   * drop to <body>. Track the last focused element while the modal is closed
   * (works for BOTH entry points: the footer pill and the Company "About"
   * link) and restore it ourselves via onCloseAutoFocus.
   */
  const returnFocusRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (open) return
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null
      if (!target || target === document.body || target.closest?.('[role="dialog"]')) return
      returnFocusRef.current = target
    }
    document.addEventListener('focusin', onFocusIn)
    return () => document.removeEventListener('focusin', onFocusIn)
  }, [open])

  const box: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : 20 },
    show: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.25, ease: 'easeOut' },
    },
    exit: { opacity: 0, y: reduce ? 0 : 20, transition: { duration: 0.18, ease: 'easeOut' } },
  }

  const stack: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.05 } },
  }

  const section: Variants = {
    hidden: reduce ? { opacity: 0 } : { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount key="about-modal-portal">
            {/* Backdrop */}
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              />
            </DialogPrimitive.Overlay>

            {/* Content box — full-screen sheet on mobile, centered dialog ≥sm */}
            <DialogPrimitive.Content
              asChild
              forceMount
              aria-modal
              onCloseAutoFocus={(event) => {
                event.preventDefault() // skip Radix's null-triggerRef restore
                ;(returnFocusRef.current ?? document.body).focus()
              }}
            >
              <motion.div
                variants={box}
                initial="hidden"
                animate="show"
                exit="exit"
                className={cn(
                  'fora-modal fixed left-0 top-0 z-50 flex h-dvh w-full flex-col border-0 bg-background text-foreground shadow-2xl outline-none',
                  'sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[85vh] sm:w-[calc(100%-2rem)] sm:max-w-[640px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border sm:border-border'
                )}
              >
                <DialogPrimitive.Close
                  className="absolute top-4 right-4 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-all duration-150 hover:bg-white/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-violet-500/60 focus-visible:outline-none sm:top-5 sm:right-5"
                  aria-label="Close about panel"
                >
                  <X className="h-4 w-4 transition-transform duration-200" aria-hidden="true" />
                  <span className="sr-only">Close</span>
                </DialogPrimitive.Close>

                <motion.div
                  variants={stack}
                  className="scrollbar-thin min-h-0 flex-1 overflow-y-auto overscroll-contain p-6 sm:p-8"
                >
                  {/* 1 · Header */}
                  <motion.div variants={section} className="pr-8">
                    <span className="inline-block rounded-full bg-violet-500/10 px-2 py-1 text-[10px] font-medium tracking-[0.2em] text-violet-400 uppercase">
                      About
                    </span>
                    <DialogPrimitive.Title className="mt-3 text-3xl font-bold tracking-tight text-foreground">
                      Hi, I&apos;m {aboutContent.name.split(' ')[0]}.
                    </DialogPrimitive.Title>
                    <DialogPrimitive.Description className="mt-1.5 text-sm text-muted-foreground">
                      {aboutContent.role} · {aboutContent.tagline}
                    </DialogPrimitive.Description>
                  </motion.div>

                  {/* 2 · Intro — photo + bio + socials */}
                  <motion.div
                    variants={section}
                    className="mt-6 flex flex-col items-center gap-5 sm:flex-row sm:items-start sm:gap-6"
                  >
                    {/* Task 40: mobile — big centered SQUARE portrait with a
                        decorative frame; sm+ keeps the compact circle. */}
                    <div
                      className={
                        'mx-auto shrink-0 rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-500 to-violet-700 p-[3px] shadow-[0_12px_48px_-12px_rgba(139,92,246,0.65)] ring-1 ring-violet-300/20 sm:rounded-full sm:bg-none sm:p-0 sm:shadow-none sm:ring-0'
                      }
                    >
                      {photoFailed ? (
                        <div
                          aria-hidden="true"
                          className="flex h-40 w-40 items-center justify-center rounded-[13px] bg-gradient-to-br from-violet-500 via-violet-600 to-violet-800 text-5xl font-bold text-white sm:h-24 sm:w-24 sm:rounded-full sm:text-3xl sm:shadow-[0_0_32px_rgba(139,92,246,0.35)]"
                        >
                          {aboutContent.name.charAt(0)}
                        </div>
                      ) : (
                        <img
                          src={aboutContent.photo}
                          alt={`Portrait of ${aboutContent.name}`}
                          width={160}
                          height={160}
                          onError={() => setPhotoFailed(true)}
                          className="h-40 w-40 rounded-[13px] object-cover sm:h-24 sm:w-24 sm:rounded-full sm:ring-2 sm:ring-violet-500/40 sm:ring-offset-2 sm:ring-offset-background"
                        />
                      )}
                    </div>

                    <div className="min-w-0 text-center sm:text-left">
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {aboutContent.bio}
                      </p>
                      <div className="mt-3 flex justify-center gap-2 sm:justify-start">
                        {SOCIAL_LINKS.map((social) => (
                          <a
                            key={social.label}
                            href={social.href}
                            {...(social.external
                              ? { target: '_blank', rel: 'noopener noreferrer' }
                              : {})}
                            aria-label={social.label}
                            title={social.label}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-muted-foreground transition-colors duration-150 hover:border-violet-500/40 hover:bg-violet-500/10 hover:text-violet-300 focus-visible:ring-2 focus-visible:ring-violet-500/60 focus-visible:outline-none"
                          >
                            <social.icon className="h-4 w-4" aria-hidden="true" />
                          </a>
                        ))}
                      </div>
                    </div>
                  </motion.div>

                  {/* 3 · Divider */}
                  <motion.div variants={section} className="my-6 border-t border-white/5" aria-hidden="true" />

                  {/* 4 · Flagship — Eventship */}
                  <motion.section variants={section} aria-label={`Flagship project: ${aboutContent.flagship.name}`}>
                    <p className="text-[10px] font-medium tracking-widest text-violet-400 uppercase">
                      {aboutContent.flagship.label}
                    </p>
                    <h3 className="mt-1.5 text-xl font-semibold tracking-tight text-foreground">
                      {aboutContent.flagship.name}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {aboutContent.flagship.description}
                    </p>

                    <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Tech stack">
                      {aboutContent.flagship.stack.map((tech) => (
                        <li
                          key={tech}
                          className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-muted-foreground"
                        >
                          {tech}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <a
                        href={aboutContent.flagship.liveUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          ACTION_BASE,
                          'w-full bg-violet-500 text-white shadow-[0_0_20px_rgba(139,92,246,0.25)] hover:bg-violet-600 sm:w-auto'
                        )}
                      >
                        Try Eventship
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </a>
                      <a
                        href={aboutContent.flagship.repoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          ACTION_BASE,
                          'w-full border border-white/10 font-normal hover:bg-white/5 sm:w-auto'
                        )}
                      >
                        View source
                      </a>
                    </div>
                  </motion.section>

                  {/* 5 · Divider */}
                  <motion.div variants={section} className="my-6 border-t border-white/5" aria-hidden="true" />

                  {/* 6 · Other projects */}
                  <motion.section variants={section} aria-label="Other projects">
                    <h3 className="text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
                      Other projects
                    </h3>
                    <ul className="mt-3 space-y-2">
                      {aboutContent.otherProjects.map((project) =>
                        project.url ? (
                          <li key={project.name}>
                            <a
                              href={project.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group -mx-2 flex items-start gap-3 rounded-lg px-2 py-2 transition-colors duration-150 hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-violet-500/60 focus-visible:outline-none"
                            >
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-medium text-foreground">
                                  {project.name}
                                </span>
                                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                                  {project.description}
                                </span>
                              </span>
                              <ArrowUpRight
                                aria-hidden="true"
                                className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors duration-150 group-hover:text-violet-400"
                              />
                            </a>
                          </li>
                        ) : (
                          <li key={project.name} className="-mx-2 flex items-start gap-3 rounded-lg px-2 py-2 opacity-50">
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium text-foreground italic">
                                {project.name}
                              </span>
                              <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                                {project.description}
                              </span>
                            </span>
                          </li>
                        )
                      )}
                    </ul>
                  </motion.section>

                  {/* 7 · Divider */}
                  <motion.div variants={section} className="my-6 border-t border-white/5" aria-hidden="true" />

                  {/* 8 · Footer CTA */}
                  <motion.footer variants={section} className="text-center">
                    <p className="text-sm text-muted-foreground">{aboutContent.cta.text}</p>
                    <a
                      href={`mailto:${aboutContent.social.email}`}
                      className={cn(
                        ACTION_BASE,
                        'mx-auto mt-3 w-full bg-violet-500 text-white shadow-[0_0_20px_rgba(139,92,246,0.25)] hover:bg-violet-600 sm:w-auto'
                      )}
                    >
                      {aboutContent.cta.emailLabel}
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                    <p className="mt-4 text-[10px] text-muted-foreground/60">
                      {aboutContent.cta.footer}
                    </p>
                  </motion.footer>
                </motion.div>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  )
}
