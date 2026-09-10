/**
 * Client-safe password strength scoring for the shared policy:
 * min 8 chars + uppercase + lowercase + number + special character.
 * Used by the PasswordStrength meter on register / reset / change-password forms.
 */

export interface StrengthCheck {
  key: 'length' | 'upper' | 'lower' | 'number' | 'special'
  label: string
  met: boolean
}

export interface PasswordStrength {
  /** 0–4 (five rules clamp to a 4-segment visual scale). */
  score: 0 | 1 | 2 | 3 | 4
  label: string
  /** Tailwind classes for the 4 filled/unfilled segments. */
  segmentClass: string
  /** Text color for the label. */
  labelClass: string
  checks: StrengthCheck[]
}

const RULES: Array<{ key: StrengthCheck['key']; label: string; test: (pw: string) => boolean }> = [
  { key: 'length', label: '8+ characters', test: (pw) => pw.length >= 8 },
  { key: 'upper', label: 'Uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
  { key: 'lower', label: 'Lowercase letter', test: (pw) => /[a-z]/.test(pw) },
  { key: 'number', label: 'Number', test: (pw) => /[0-9]/.test(pw) },
  { key: 'special', label: 'Special character', test: (pw) => /[^A-Za-z0-9]/.test(pw) },
]

const LEVELS: Array<{
  label: string
  segmentClass: string
  labelClass: string
}> = [
  { label: 'Very weak', segmentClass: 'bg-red-500/70 dark:bg-red-500/60', labelClass: 'text-red-600 dark:text-red-400' },
  { label: 'Weak', segmentClass: 'bg-red-500/70 dark:bg-red-500/60', labelClass: 'text-red-600 dark:text-red-400' },
  { label: 'Fair', segmentClass: 'bg-amber-500/80 dark:bg-amber-500/70', labelClass: 'text-amber-600 dark:text-amber-400' },
  { label: 'Good', segmentClass: 'bg-emerald-500/70 dark:bg-emerald-500/60', labelClass: 'text-emerald-600 dark:text-emerald-400' },
  { label: 'Strong', segmentClass: 'bg-emerald-600 dark:bg-emerald-500', labelClass: 'text-emerald-700 dark:text-emerald-300' },
]

/** Score a password against the shared policy. Pure function — safe everywhere. */
export function scorePassword(password: string): PasswordStrength {
  const checks: StrengthCheck[] = RULES.map((rule) => ({
    key: rule.key,
    label: rule.label,
    met: rule.test(password),
  }))

  const met = checks.filter((c) => c.met).length
  // 5 rules → 0–5; map 5 to the strongest visual level (4), 0–1 both weakest.
  const score = Math.max(0, Math.min(4, met - 1)) as PasswordStrength['score']
  const level = LEVELS[score]

  return {
    score: password.length === 0 ? 0 : score,
    label: password.length === 0 ? '' : level.label,
    segmentClass: level.segmentClass,
    labelClass: level.labelClass,
    checks,
  }
}
