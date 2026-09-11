import { TrendingDown, TrendingUp } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '@/lib/utils'

const KPIS = [
  { label: 'Completion', value: '87%', delta: '+4.2%', up: true },
  { label: 'On-time', value: '92%', delta: '+1.8%', up: true },
  { label: 'Blockers', value: '3', delta: '-2', up: false },
] as const

const MEMBERS = [
  { name: 'Maya R.', done: 92 },
  { name: 'Omar H.', done: 78 },
  { name: 'David K.', done: 64 },
] as const

const COMPLETED_LINE = '0,74 40,70 80,60 120,64 160,50 200,44 240,34 280,30 320,20'
const CREATED_LINE = '0,80 40,76 80,70 120,72 160,62 200,58 240,52 280,48 320,42'

/**
 * CSS/SVG-only analytics mockup: KPI cards, a dual-line progress chart and
 * per-member workload bars. Decorative only.
 */
export function AnalyticsMockup() {
  const reduce = useReducedMotion()

  return (
    <div
      role="img"
      aria-label="Preview of the real-time analytics dashboard with KPI cards, trend chart and workload bars"
      className="rounded-xl border border-fora-border bg-fora-surface p-4 shadow-[0_40px_120px_-32px_rgba(0,0,0,0.85)] md:p-5"
    >
      {/* KPI row */}
      <div className="grid grid-cols-3 gap-2 md:gap-3">
        {KPIS.map((kpi) => (
          <div key={kpi.label} className="rounded-lg border border-fora-border bg-fora-surface-2/60 p-2.5 md:p-3.5">
            <p className="text-[9px] uppercase tracking-[0.12em] text-fora-muted md:text-[10px]">{kpi.label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-white md:text-2xl">{kpi.value}</p>
            <p
              className={cn(
                'mt-0.5 inline-flex items-center gap-1 text-[9px] font-medium md:text-[10px]',
                kpi.up ? 'text-emerald-300' : 'text-red-300',
              )}
            >
              {kpi.up ? <TrendingUp className="h-2.5 w-2.5" aria-hidden="true" /> : <TrendingDown className="h-2.5 w-2.5" aria-hidden="true" />}
              {kpi.delta}
            </p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="mt-3 rounded-lg border border-fora-border bg-fora-surface-2/40 p-3 md:mt-4">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-medium text-white md:text-[11px]">Progress over time</p>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-fora-accent/30 bg-fora-accent/10 px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-fora-glow">
            <span className="fora-pulse-ring h-1 w-1 rounded-full bg-fora-accent" />
            Live
          </span>
        </div>
        <svg viewBox="0 0 320 90" className="mt-2 h-24 w-full md:h-28" preserveAspectRatio="none">
          <defs>
            <linearGradient id="analytics-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[18, 42, 66].map((y) => (
            <line key={y} x1="0" y1={y} x2="320" y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          ))}
          <motion.polygon
            points={`${COMPLETED_LINE} 320,90 0,90`}
            fill="url(#analytics-area)"
            initial={reduce ? false : { opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: 0.5 }}
          />
          <motion.polyline
            points={CREATED_LINE}
            fill="none"
            stroke="rgba(160,160,160,0.5)"
            strokeWidth="1.5"
            strokeDasharray="3 3"
            initial={reduce ? false : { pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.3, delay: 0.25, ease: 'easeOut' }}
          />
          <motion.polyline
            points={COMPLETED_LINE}
            fill="none"
            stroke="#818cf8"
            strokeWidth="2"
            strokeLinecap="round"
            initial={reduce ? false : { pathLength: 0 }}
            whileInView={{ pathLength: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.3, delay: 0.1, ease: 'easeOut' }}
          />
        </svg>
      </div>

      {/* Workload bars */}
      <div className="mt-3 space-y-2.5 md:mt-4 md:space-y-3">
        {MEMBERS.map((member, i) => (
          <div key={member.name} className="flex items-center gap-3">
            <span className="w-14 shrink-0 text-[10px] text-fora-text-2 md:text-[11px]">{member.name}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-fora-accent to-fora-glow"
                initial={reduce ? false : { scaleX: 0 }}
                whileInView={{ scaleX: member.done / 100 }}
                viewport={{ once: true }}
                transition={{ duration: 1, delay: 0.2 + i * 0.12, ease: [0.22, 1, 0.36, 1] }}
                style={{ originX: 0 }}
              />
            </div>
            <span className="w-9 shrink-0 text-right text-[10px] tabular-nums text-fora-muted md:text-[11px]">{member.done}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
