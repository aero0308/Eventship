/**
 * iCalendar (RFC 5545) export helpers — client-side.
 * Builds a standards-compliant .ics payload (CRLF, line folding, text escaping)
 * for all-day events and triggers a browser download. Also builds a
 * Google Calendar "add event" template URL for one-click imports.
 */

export interface IcsEventInput {
  /** Stable unique identifier (we use the DB event UUID). */
  uid: string
  title: string
  description?: string | null
  location?: string | null
  /** ISO start date. */
  start: string
  /** ISO end date (inclusive in the app; exported as exclusive all-day end). */
  end: string
  status?: 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED'
  /** Absolute URL back to the event in Eventship (optional). */
  url?: string
}

/** RFC 5545 §3.3.11 — escape TEXT values. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/**
 * RFC 5545 §3.1 — content lines longer than 75 octets must be folded:
 * continuation lines begin with a single space.
 */
function foldLine(line: string): string[] {
  if (line.length <= 73) return [line]
  const parts: string[] = []
  let rest = line
  let first = true
  while (rest.length > 0) {
    const width = first ? 73 : 72 // leave room for the leading space on continuations
    parts.push(first ? rest.slice(0, width) : ` ${rest.slice(0, width)}`)
    rest = rest.slice(width)
    first = false
  }
  return parts
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** Local calendar date as YYYYMMDD (all-day values ignore time/timezone). */
function toDateStamp(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
}

/** UTC datetime as YYYYMMDDTHHMMSSZ — used for DTSTAMP. */
function toUtcStamp(date: Date): string {
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`
  )
}

/** Google Calendar template URL for a single all-day event (end date exclusive). */
export function googleCalendarUrl(event: IcsEventInput, appUrl?: string): string {
  const start = toDateStamp(event.start)
  const endExclusive = new Date(new Date(event.end).getTime() + 24 * 60 * 60 * 1000)
  const end = toDateStamp(endExclusive.toISOString())
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${start}/${end}`,
  })
  if (event.description) {
    const details = appUrl ? `${event.description}\n\n${appUrl}` : event.description
    params.set('details', details)
  } else if (appUrl) {
    params.set('details', appUrl)
  }
  if (event.location) params.set('location', event.location)
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/**
 * Build a full VCALENDAR document from the given all-day events.
 * Each event gets a 1-day-before VALARM reminder.
 */
export function buildIcs(events: IcsEventInput[], calName = 'Eventship events'): string {
  const now = toUtcStamp(new Date())
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Eventship//Event Management System//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calName)}`,
  ]

  for (const event of events) {
    const start = toDateStamp(event.start)
    // DTEND is exclusive for DATE values → move to the day after the app's inclusive end.
    const end = toDateStamp(new Date(new Date(event.end).getTime() + 24 * 60 * 60 * 1000).toISOString())
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${event.uid}@eventship`)
    lines.push(`DTSTAMP:${now}`)
    lines.push(`DTSTART;VALUE=DATE:${start}`)
    lines.push(`DTEND;VALUE=DATE:${end}`)
    lines.push(`SUMMARY:${escapeText(event.title)}`)
    if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`)
    if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`)
    if (event.url) lines.push(`URL:${event.url}`)
    lines.push(`STATUS:${event.status ?? 'CONFIRMED'}`)
    lines.push('TRANSP:TRANSPARENT')
    lines.push('BEGIN:VALARM')
    lines.push('ACTION:DISPLAY')
    lines.push(`DESCRIPTION:${escapeText(`${event.title} starts tomorrow`)}`)
    lines.push('TRIGGER:-P1D')
    lines.push('END:VALARM')
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')
  // Fold every content line, then join with CRLF as required by RFC 5545.
  return lines.flatMap(foldLine).join('\r\n')
}

/** Trigger a browser download of an .ics file. */
export function downloadIcs(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.ics') ? filename : `${filename}.ics`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/** Filesystem-safe slug for export filenames. */
export function slugifyFilename(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'event'
  )
}
