'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FadeIn } from '@/components/landing/FadeIn'
import { SectionLabel } from '@/components/landing/SectionLabel'

const FAQS = [
  {
    question: 'How many users can I add?',
    answer:
      'As many as your team needs. The free plan covers teams of up to 5 with full feature access; paid plans scale to unlimited members with role-based access for managers, team leaders and employees.',
  },
  {
    question: 'Is there a free plan?',
    answer:
      'Yes — free forever for teams up to 5. That includes the kanban board, blocker reporting, the real-time dashboard and notifications. No credit card required to sign up.',
  },
  {
    question: 'Does it support real-time updates?',
    answer:
      'Every surface is socket-powered: task moves, comments, blockers and dashboard stats propagate to everyone in the event in under a second — no refresh, no polling.',
  },
  {
    question: 'Can I export reports?',
    answer:
      'Yes. Task boards and analytics views export to CSV, so you can drop completion data straight into post-event reports or your BI tool of choice.',
  },
  {
    question: 'How secure is my data?',
    answer:
      'Sessions are httpOnly cookie-based, passwords are salted and hashed, and every role only ever sees the events and tasks it owns. Data is scoped per team — employees can never browse outside their assignment.',
  },
  {
    question: 'Can I cancel anytime?',
    answer:
      'Anytime, in one click, from your profile. There are no lock-ins and no cancellation fees — your data stays exportable for 30 days after downgrading.',
  },
] as const

function FaqItem({
  question,
  answer,
  open,
  onToggle,
  index,
}: {
  question: string
  answer: string
  open: boolean
  onToggle: () => void
  index: number
}) {
  return (
    <div className="border-b border-fora-border">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`faq-panel-${index}`}
        onClick={onToggle}
        className="group flex w-full items-center justify-between gap-6 py-6 text-left"
      >
        <span
          className={cn(
            'text-base font-medium transition-colors duration-200 md:text-lg',
            open ? 'text-white' : 'text-zinc-200 group-hover:text-white',
          )}
        >
          {question}
        </span>
        <span
          aria-hidden="true"
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all duration-300',
            open
              ? 'rotate-180 border-fora-accent/50 bg-fora-accent/15 text-fora-glow'
              : 'border-fora-border text-fora-muted group-hover:border-fora-border-hover group-hover:text-white',
          )}
        >
          <ChevronDown className="h-4 w-4" />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={`faq-panel-${index}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="max-w-2xl pb-7 pr-10 text-sm leading-relaxed text-fora-text-2 md:text-base">{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * FAQ: single-open accordion with smooth height animation, accent chevron
 * and hover states, wrapped in a narrow editorial column.
 */
export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-24 py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <SectionLabel>FAQ</SectionLabel>
        <FadeIn>
          <h2
            id="faq-title"
            className="mx-auto mt-5 max-w-3xl text-center text-[clamp(2rem,4.5vw,3.5rem)] font-semibold leading-[1.06] tracking-[-0.03em] text-white"
          >
            Frequently asked{' '}
            <span className="font-fora-serif font-normal italic tracking-[-0.01em] text-fora-text-2">questions.</span>
          </h2>
        </FadeIn>

        <FadeIn delay={0.1} className="mx-auto mt-14 max-w-3xl md:mt-16">
          <div className="border-t border-fora-border">
            {FAQS.map((faq, index) => (
              <FaqItem
                key={faq.question}
                index={index}
                question={faq.question}
                answer={faq.answer}
                open={openIndex === index}
                onToggle={() => setOpenIndex(openIndex === index ? null : index)}
              />
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-fora-muted">
            Still curious? Write to{' '}
            <a href="mailto:hello@eventos.co" className="text-fora-glow transition-colors hover:text-white">
              hello@eventos.co
            </a>
          </p>
        </FadeIn>
      </div>
    </section>
  )
}
