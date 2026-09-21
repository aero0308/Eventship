/**
 * Single source of truth for the "About the developer" panel
 * (see AboutModal.tsx). Pure data — no markup — so copy/links can be
 * updated without touching the component.
 *
 * `photo` points at /public/about/me.jpg; when the file is absent the
 * modal renders the violet "S" fallback avatar (onError handler).
 */
interface AboutProject {
  name: string
  description: string
  /** `null` renders the muted, non-clickable "coming soon" row. */
  url: string | null
}

interface AboutSocial {
  github: string
  linkedin: string
  /** Bare address — rendered as a `mailto:` link. */
  email: string
}

interface AboutFlagship {
  label: string
  name: string
  description: string
  stack: readonly string[]
  liveUrl: string
  repoUrl: string
}

interface AboutCta {
  text: string
  emailLabel: string
  footer: string
}

interface AboutContent {
  name: string
  role: string
  tagline: string
  bio: string
  photo: string
  social: AboutSocial
  flagship: AboutFlagship
  otherProjects: readonly AboutProject[]
  cta: AboutCta
}

export const aboutContent: AboutContent = {
  name: 'Sachin Gupta',
  role: 'Full-Stack Developer',
  tagline: 'Building things. Open to opportunities.',
  bio: 'I build simple, practical software focused on solving real problems. Eventship is my flagship project and a reflection of my approach to creating clean, useful, and efficient products.',
  photo: '/about/me.jpg',
  social: {
    github: 'https://github.com/aero0308',
    linkedin: 'https://www.linkedin.com/in/sachin-gupta-52aa923aa/',
    email: 'sachingupta03off@gmail.com',
  },
  flagship: {
    label: 'Now building',
    name: 'Eventship',
    description:
      'Event teams lose visibility the moment chaos hits. Spreadsheets break, blockers go unreported, and status meetings eat hours. Eventship fixes that with real-time task tracking and blocker reporting — so teams ship events without the fire drills.',
    stack: ['Next.js 16', 'React 19', 'Prisma', 'PostgreSQL', 'Socket.IO'],
    liveUrl: 'https://eventship-seven.vercel.app/#/',
    repoUrl: 'https://github.com/aero0308/Eventship',
  },
  otherProjects: [
    {
      name: 'HabitFlow',
      description: 'Track habits and understand how they affect your mood.',
      url: 'https://habit-flow-nine-eta.vercel.app/',
    },
    {
      name: 'Mindful-Oasis',
      description: 'A calm space for mindfulness and mental wellness.',
      url: 'https://aero0308.github.io/Mindful-Oasis/',
    },
    {
      name: 'LeetScore',
      description: 'Track and visualize your LeetCode progress over time.',
      url: 'https://aero0308.github.io/LeetScore/',
    },
    {
      name: 'More coming soon',
      description: 'Currently exploring new ideas.',
      url: null,
    },
  ],
  cta: {
    text: 'Got a project in mind or want to say hi?',
    emailLabel: 'Email me',
    footer: 'Built solo. Open to feedback and opportunities.',
  },
}
