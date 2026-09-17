/**
 * Editorial content for the blog.
 *
 * Each post is a complete, self-contained article: intro paragraphs, numbered
 * sections (which drive the "In this Article" table of contents), a pull
 * quote and tag pills. All posts are authored by the site owner — no fictional
 * personas. The article page renders this data 1:1 — add a post here and it
 * automatically appears in the landing grid and gets its own route at
 * #/blog/<slug>.
 */

export interface BlogSection {
  /** DOM id for the section heading (anchor + scroll-spy). */
  id: string
  heading: string
  paragraphs: string[]
  /** Optional bulleted list rendered after the paragraphs. */
  list?: string[]
}

export interface BlogPost {
  slug: string
  category: string
  readTime: string
  /** Display-only updated date, e.g. "12 January 2025". */
  updatedOn: string
  title: string
  excerpt: string
  image: string
  imageAlt: string
  /** Real author display name — no fictional personas. */
  author: string
  tags: string[]
  intro: string[]
  quote: { text: string }
  sections: BlogSection[]
  closing: string[]
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: 'run-200-person-event',
    category: 'Playbooks',
    readTime: '6 min read',
    updatedOn: '17 September 2026',
    title: 'How to run a 200-person event without losing your mind',
    excerpt:
      'The checklist system, the comms cadence and the 72-hour runbook that keep big events calm.',
    image: '/images/landing/blog-1.png',
    imageAlt:
      'Event crew with headsets coordinating a live show from laptops on the venue floor',
    author: 'Sachin Gupta',
    tags: ['Planning', 'Teams', 'Playbooks'],
    intro: [
      'Somewhere between your 40th-person meetup and your first 200-person conference, the job changes. It stops being a big to-do list and becomes a distributed system: vendors, volunteers, speakers, venues and a thousand small commitments that all land on the same day.',
      'The organizers who make it look easy are not calmer people. They run a system — a checklist architecture, a communication cadence and a runbook for the final 72 hours — so that no single person ever becomes the bottleneck. Here is the system we use, and the one we now build Eventship around.',
    ],
    quote: {
      text: 'Calm events are not lucky. They are rehearsed.',
    },
    sections: [
      {
        id: 'run-of-show',
        heading: 'Start with the run of show, not the to-do list',
        paragraphs: [
          'A to-do list is flat; an event is not. The moment you sequence the day — doors at 9:00, keynote at 9:30, catering reset at 10:45 — every task acquires a deadline it can be early or late for. That is the whole game.',
          'Write the run of show before anything else, in fifteen-minute blocks, from doors open to last attendee out. Every downstream task (signage, staffing, AV checks) then gets scheduled backwards from the moment it must be finished by. Tasks without a run-of-show anchor are how things silently slip to the morning of.',
        ],
      },
      {
        id: 'checklist-system',
        heading: 'The checklist system: three layers deep',
        paragraphs: [
          'One giant checklist fails at 200 people because nobody can see their part in it. We split everything into three layers, each owned by exactly one person.',
        ],
        list: [
          'Milestones — venue signed, CFP closed, badges shipped. Owned by the event lead, reviewed weekly.',
          'Workstreams — AV, catering, registration, speakers. Owned by a team lead, reviewed twice a week.',
          'Tasks — “print 220 table tents”, “confirm mic for workshop B”. Owned by individuals, updated daily.',
        ],
      },
      {
        id: 'comms-cadence',
        heading: 'Comms cadence: who needs to know what, and when',
        paragraphs: [
          'Most event panic is actually communication debt. The projector was always broken — it just took three weeks for the information to reach the person who could fix it. A fixed cadence prevents that: a 25-minute all-hands on Mondays, asynchronous written updates from every workstream on Wednesdays and Fridays, and a nightly 10-minute standup during the final week.',
          'Keep every update in writing and in one place. If it only happened in a hallway, it did not happen. The written trail is also what lets new volunteers onboard in an afternoon instead of a week.',
        ],
      },
      {
        id: 'runbook',
        heading: 'The 72-hour runbook',
        paragraphs: [
          'The last three days have a different rhythm: nothing new gets planned, and everything gets verified. Print assets are checked against the final agenda, AV is walked end-to-end with a real presenter, registration is load-tested with fake attendees, and every vendor re-confirms in writing.',
          'We also freeze scope at T-72. Good ideas that arrive inside the final window go on a “next time” list, not into the plan. Almost every event disaster we have witnessed traces back to a change made inside the last three days.',
        ],
      },
      {
        id: 'when-things-break',
        heading: 'When (not if) something breaks',
        paragraphs: [
          'Name a decision-maker per workstream and agree on a single escalation channel — one phone number, one thread. During the event, the goal is not to fix problems yourself; it is to make sure the right person hears about each problem within five minutes.',
          'And log what breaks. The debrief takes thirty minutes the day after, while the pain is fresh, and it is the difference between your second 200-person event and your tenth first one.',
        ],
      },
    ],
    closing: [
      'None of this requires heroics — that is the point. The system absorbs the chaos so the team does not have to. Start with the run of show, layer the checklists, set the cadence, and rehearse the final 72 hours.',
    ],
  },
  {
    slug: 'event-timeline-blockers',
    category: 'Operations',
    readTime: '4 min read',
    updatedOn: '17 September 2026',
    title: 'The 5 blockers that kill event timelines',
    excerpt:
      'Vendor sign-offs, venue access, printed assets — where launches actually get stuck, and how to pre-empt them.',
    image: '/images/landing/blog-2.png',
    imageAlt:
      'Planning wall covered in timeline notes under desk lamps, one red flag card lit up in the middle',
    author: 'Sachin Gupta',
    tags: ['Operations', 'Vendors', 'Timelines'],
    intro: [
      'After enough events, you notice the timeline does not die from surprises. It dies from the same five blockers, every time, wearing slightly different costumes.',
      'This is the field guide: what each blocker looks like on the floor, the early warning signs, and the pre-emptive move that keeps it from ever reaching your critical path.',
    ],
    quote: {
      text: 'A blocker flagged on Monday costs an email. The same blocker flagged on load-in day costs the keynote.',
    },
    sections: [
      {
        id: 'vendor-signoffs',
        heading: 'Vendor sign-offs that arrive late',
        paragraphs: [
          'The caterer needs final numbers by the 10th, the print shop needs artwork by the 12th, and each of them is waiting on a document that is technically “in review”. Late sign-offs are the single most common source of silent timeline compression.',
          'Pre-empt it by attaching a deadline to every dependency the moment it is created — and make the deadline visible to the person who has to sign, not just the person who needs the signature. A blocker board that only the organizing team can see is a diary, not a tool.',
        ],
      },
      {
        id: 'venue-access',
        heading: 'Venue access that was never confirmed in writing',
        paragraphs: [
          '“Doors open at 6” and “we can load in from 6” are very different sentences. Access windows, freight elevators, after-hours fees and which rooms are actually unlocked at 7 a.m. — none of it is real until the venue has confirmed it in writing.',
          'The pre-emptive move is a one-page access sheet, re-confirmed with the venue at T-7 and again at T-1, pinned where the whole crew can see it. Every veteran floor manager has a story about a truck idling outside a locked loading dock; none of them want another.',
        ],
      },
      {
        id: 'printed-assets',
        heading: 'Printed assets stuck in review',
        paragraphs: [
          'Badges, signage, programs and table tents look like small tasks and behave like long lead-time ones. A name misspelled on a badge found at T-2 is a reprint, a courier and a morning. The review chain — designer, content owner, final approver — is where the time actually goes.',
          'Move reviews earlier by making drafts visible in the open, and set an approval-by date at least a week before print. If your team flags stuck assets in a shared board, the reviewer who is on vacation becomes visible before it hurts.',
        ],
      },
      {
        id: 'quiet-dependency',
        heading: 'The quiet dependency no one owned',
        paragraphs: [
          'Every timeline has one task that everyone assumed someone else was handling: the WiFi password for the speaker room, the deposit for the chairs, the microphone for Q&A. It never appears on a status call because nobody knows it is stuck.',
          'Kill it with ownership: every task has exactly one name on it, and “unassigned” is a state your team reviews daily. If a task cannot find an owner by T-14, it is not a task — it is a decision you are avoiding.',
        ],
      },
      {
        id: 'av-changes',
        heading: 'AV and staging changes after load-in',
        paragraphs: [
          'The final killer arrives at 4 p.m. on setup day: a presenter wants a second screen, the CEO wants a center aisle, the sponsor brings a roll-up banner that needs a home. Each change is reasonable. Together, at load-in, they can consume your entire contingency.',
          'The fix is cultural, not technical: changes after load-in go through one person and get written down, and the crew knows that “no” is an available answer. Your AV partner will love you, and your agenda will survive contact with reality.',
        ],
      },
    ],
    closing: [
      'None of these five blockers are exotic — that is exactly why they are worth a system. Flag early, in the open, with a named owner, and your timeline stops being a guessing game.',
    ],
  },
  {
    slug: 'real-time-dashboards-beat-status-meetings',
    category: 'Product',
    readTime: '5 min read',
    updatedOn: '17 September 2026',
    title: 'Why real-time dashboards beat status meetings',
    excerpt:
      'Status meetings are a polling loop. Live dashboards are an event stream. The math favors one of them.',
    image: '/images/landing/blog-3.png',
    imageAlt:
      'Live analytics dashboard with charts glowing on a monitor in a dark office at night',
    author: 'Sachin Gupta',
    tags: ['Product', 'Real-time', 'Teams'],
    intro: [
      'Every status meeting ever scheduled follows the same script: eight people, sixty minutes, and the first forty minutes spent answering a question that has an answer already — “how are things going?”',
      'The meeting is a polling loop: each person periodically asks each other person for state. A real-time dashboard is an event stream: state is pushed the moment it changes, and the meeting is free to do the one thing meetings are actually good at — deciding.',
    ],
    quote: {
      text: 'Progress you can see is progress you do not have to ask about.',
    },
    sections: [
      {
        id: 'polling-loop',
        heading: 'The status meeting is a polling loop',
        paragraphs: [
          'In engineering terms, a weekly status meeting polls for state at 0.0003 Hz — once per 3,600 seconds per person. Anything that happened since the last poll is either stale news or, worse, an unreported problem that has been compounding for six days.',
          'Polling also taxes the people doing the work. Interrupting a focused afternoon to narrate status that “is fine” is how teams learn to resent synchronization — and why status slides get cosmetically green.',
        ],
      },
      {
        id: 'event-stream',
        heading: 'Dashboards are an event stream',
        paragraphs: [
          'A live dashboard inverts the model. When a card moves to Done, the completion chart moves. When a task is flagged blocked, it appears on the blocker strip the second it is flagged. Nobody prepares for it, because the dashboard is always already up to date.',
          'The result is ambient awareness: the same background knowledge a co-located team gets by glancing at each other’s screens, available to a distributed team in three time zones.',
        ],
      },
      {
        id: 'ambient-progress',
        heading: 'What actually changes when progress is ambient',
        paragraphs: [
          'Three things, consistently. First, meetings shrink: the weekly sync goes from 60 minutes of recital to 25 minutes of decisions. Second, wins get noticed: a quiet teammate finishing a hard task is visible instantly, which is worth more than any retro shout-out. Third, drift becomes undeniable — a workstream whose chart has been flat for four days will surface in conversation long before it surfaces in a miss.',
        ],
        list: [
          'Status questions answered by the surface, not by interrupting people',
          'Blockers visible to whoever can unblock them, within minutes',
          'A shared, written version of “how are we doing” that never goes stale',
        ],
      },
      {
        id: 'blockers-in-minutes',
        heading: 'Blockers surface in minutes, not Mondays',
        paragraphs: [
          'The highest-leverage difference is latency on bad news. In a polling world, a blocked task waits on average half a meeting-cycle before the right person sees it. On a live board, the flag, the comment and the escalation all happen in the same place the work lives.',
          'When we shipped live dashboards into Eventship, the first thing teams told us was not “the charts are pretty.” It was that Monday meetings got shorter — and that blocked work stopped waiting for Monday at all.',
        ],
      },
      {
        id: 'meetings-for-decisions',
        heading: 'Meetings are for decisions, not recaps',
        paragraphs: [
          'None of this makes meetings worthless; it makes them expensive again. When the recap is automated, the meeting that remains can be worth its cost: the trade-off call, the scope cut, the “who owns this” decision that actually needs eight brains in a room.',
          'Start small. Keep your next status meeting, but put a live dashboard on the screen instead of a slide deck, and watch what happens to the first thirty minutes.',
        ],
      },
    ],
    closing: [
      'The dashboard does not replace the team’s judgment — it replaces the team’s need to narrate. That is a better deal for everyone, especially the person who was making the slides.',
    ],
  },
]

/** Look up a post by its slug. */
export function getBlogPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((post) => post.slug === slug)
}

/** The other posts, in display order (for "Related articles"). */
export function getRelatedPosts(slug: string): BlogPost[] {
  return BLOG_POSTS.filter((post) => post.slug !== slug)
}
