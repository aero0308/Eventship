/**
 * Seed script for the Event Management System.
 * Run with: bun prisma/seed.ts
 * Creates demo users, teams, events, tasks, comments, dependencies,
 * notifications and activity logs with realistic relative dates.
 */
import { PrismaClient } from '@prisma/client'
import { randomBytes, scryptSync } from 'crypto'

const prisma = new PrismaClient()

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const derived = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${derived}`
}

const day = 24 * 60 * 60 * 1000
const now = Date.now()
const daysFromNow = (d: number, hourOffset = 0) => new Date(now + d * day - hourOffset * 60 * 60 * 1000)
const daysAgo = (d: number, hourOffset = 0) => new Date(now - d * day - hourOffset * 60 * 60 * 1000)

async function main() {
  console.log('🌱 Seeding Event Management System...')

  // Clean slate (order matters for FKs: PasswordResetToken → user,
  // Room.ownerId / Event.createdBy / Task.createdBy restrict → children first,
  // room before users it references).
  await prisma.activityLog.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.taskDependency.deleteMany()
  await prisma.taskComment.deleteMany()
  await prisma.task.deleteMany()
  await prisma.event.deleteMany()
  await prisma.passwordResetToken.deleteMany()
  await prisma.session.deleteMany()
  await prisma.team.deleteMany()
  await prisma.room.deleteMany()
  await prisma.user.deleteMany()

  // ---------- Teams (roomId linked after room + owner exist below) ----------
  const ops = await prisma.team.create({
    data: {
      name: 'Operations',
      description: 'Venue logistics, catering and on-site coordination.',
    },
  })
  const tech = await prisma.team.create({
    data: {
      name: 'Tech & AV',
      description: 'Staging, sound, lighting, streaming and registration tech.',
    },
  })
  const marketing = await prisma.team.create({
    data: {
      name: 'Marketing & Outreach',
      description: 'Promotion, sponsorships, social media and PR.',
    },
  })

  // ---------- Users ----------
  const password = hashPassword('password123')
  const admin = await prisma.user.create({
    data: {
      email: 'admin@eventship.io',
      fullName: 'Alex Morgan',
      hashedPassword: password,
      role: 'EVENT_MANAGER',
      createdAt: daysAgo(60),
    },
  })
  const maria = await prisma.user.create({
    data: {
      email: 'maria@eventship.io',
      fullName: 'Maria Chen',
      hashedPassword: password,
      role: 'TEAM_LEADER',
      teamId: ops.id,
      createdAt: daysAgo(55),
    },
  })
  const james = await prisma.user.create({
    data: {
      email: 'james@eventship.io',
      fullName: 'James Patel',
      hashedPassword: password,
      role: 'TEAM_LEADER',
      teamId: tech.id,
      createdAt: daysAgo(54),
    },
  })
  const sofia = await prisma.user.create({
    data: {
      email: 'sofia@eventship.io',
      fullName: 'Sofia Reyes',
      hashedPassword: password,
      role: 'TEAM_LEADER',
      teamId: marketing.id,
      createdAt: daysAgo(52),
    },
  })
  const david = await prisma.user.create({
    data: {
      email: 'david@eventship.io',
      fullName: 'David Kim',
      hashedPassword: password,
      role: 'EMPLOYEE',
      teamId: ops.id,
      createdAt: daysAgo(40),
    },
  })
  const priya = await prisma.user.create({
    data: {
      email: 'priya@eventship.io',
      fullName: 'Priya Sharma',
      hashedPassword: password,
      role: 'EMPLOYEE',
      teamId: tech.id,
      createdAt: daysAgo(38),
    },
  })
  const tom = await prisma.user.create({
    data: {
      email: 'tom@eventship.io',
      fullName: 'Tom Becker',
      hashedPassword: password,
      role: 'EMPLOYEE',
      teamId: tech.id,
      createdAt: daysAgo(30),
    },
  })
  const lena = await prisma.user.create({
    data: {
      email: 'lena@eventship.io',
      fullName: 'Lena Fischer',
      hashedPassword: password,
      role: 'EMPLOYEE',
      teamId: marketing.id,
      createdAt: daysAgo(28),
    },
  })
  const omar = await prisma.user.create({
    data: {
      email: 'omar@eventship.io',
      fullName: 'Omar Haddad',
      hashedPassword: password,
      role: 'EMPLOYEE',
      teamId: ops.id,
      createdAt: daysAgo(20),
    },
  })

  // ---------- Room (multi-tenant: owner now exists, so create + link) ----------
  const room = await prisma.room.create({
    data: {
      roomCode: 'EVT-DEM258',
      name: 'Eventship Demo HQ',
      description: 'Demo room for the seeded workspace — share EVT-DEM258 / demo1234 to try the join flow.',
      passwordHash: hashPassword('demo1234'),
      ownerId: admin.id,
    },
  })
  await prisma.user.updateMany({
    where: { id: { in: [admin.id, maria.id, james.id, sofia.id, david.id, priya.id, tom.id, lena.id, omar.id] } },
    data: { roomId: room.id },
  })
  await prisma.team.updateMany({
    where: { id: { in: [ops.id, tech.id, marketing.id] } },
    data: { roomId: room.id },
  })

  // Team managers
  await prisma.team.update({ where: { id: ops.id }, data: { managerId: maria.id } })
  await prisma.team.update({ where: { id: tech.id }, data: { managerId: james.id } })
  await prisma.team.update({ where: { id: marketing.id }, data: { managerId: sofia.id } })

  // ---------- Events ----------
  const conf = await prisma.event.create({
    data: {
      name: 'Annual Tech Conference 2025',
      description:
        'Flagship one-day conference with 3 tracks, 18 speakers, live streaming and a startup expo floor.',
      startDate: daysFromNow(21),
      endDate: daysFromNow(21, 0),
      status: 'IN_PROGRESS',
      teamId: ops.id,
      createdBy: admin.id,
      roomId: room.id,
      createdAt: daysAgo(25),
    },
  })
  const launch = await prisma.event.create({
    data: {
      name: 'Product Launch Gala',
      description: 'Evening gala to unveil the new platform. 300 guests, press, live demo stations.',
      startDate: daysFromNow(45),
      endDate: daysFromNow(45),
      status: 'PLANNING',
      teamId: marketing.id,
      createdBy: admin.id,
      roomId: room.id,
      createdAt: daysAgo(18),
    },
  })
  const hackathon = await prisma.event.create({
    data: {
      name: 'Internal Hackathon',
      description: '48-hour internal innovation sprint with 12 teams and demo day judging.',
      startDate: daysFromNow(75),
      endDate: daysFromNow(77),
      status: 'DRAFT',
      teamId: tech.id,
      createdBy: james.id,
      roomId: room.id,
      createdAt: daysAgo(10),
    },
  })
  const run = await prisma.event.create({
    data: {
      name: 'Charity Fun Run',
      description: '5K community run raising funds for local schools. Route permits and medical support required.',
      startDate: daysAgo(14),
      endDate: daysAgo(14),
      status: 'COMPLETED',
      teamId: ops.id,
      createdBy: maria.id,
      roomId: room.id,
      createdAt: daysAgo(50),
    },
  })
  const workshop = await prisma.event.create({
    data: {
      name: 'Customer Workshop Series',
      description: 'Three half-day hands-on workshops for enterprise customers in June.',
      startDate: daysFromNow(9),
      endDate: daysFromNow(16),
      status: 'PLANNING',
      teamId: tech.id,
      createdBy: admin.id,
      roomId: room.id,
      createdAt: daysAgo(12),
    },
  })
  const mixer = await prisma.event.create({
    data: {
      name: 'Partner Mixer (Q3)',
      description: 'Cancelled due to venue conflict — postponed to Q4.',
      startDate: daysFromNow(30),
      endDate: daysFromNow(30),
      status: 'CANCELLED',
      teamId: marketing.id,
      createdBy: sofia.id,
      roomId: room.id,
      createdAt: daysAgo(35),
    },
  })

  // ---------- Tasks ----------
  async function task(data: {
    title: string
    description?: string
    priority?: string
    status?: string
    eventId: string
    assignedTo?: string | null
    createdBy: string
    dueDate?: Date | null
    estimatedHours?: number | null
    actualHours?: number | null
  }) {
    return prisma.task.create({ data: { ...data, roomId: room.id } })
  }

  const t1 = await task({
    title: 'Book main venue & sign contract',
    description: 'Negotiate final pricing for the convention center hall A + expo foyer.',
    priority: 'HIGH', status: 'COMPLETED', eventId: conf.id, assignedTo: maria.id, createdBy: admin.id,
    dueDate: daysAgo(10), estimatedHours: 12, actualHours: 14,
  })
  const t2 = await task({
    title: 'Catering tasting & menu selection',
    description: 'Three vendors shortlisted; pick menu for 500 attendees incl. vegan options.',
    priority: 'MEDIUM', status: 'IN_PROGRESS', eventId: conf.id, assignedTo: david.id, createdBy: maria.id,
    dueDate: daysFromNow(4), estimatedHours: 8,
  })
  const t3 = await task({
    title: 'Set up live-stream pipeline',
    description: 'Multi-camera setup, encoder config, backup CDN failover.',
    priority: 'HIGH', status: 'IN_PROGRESS', eventId: conf.id, assignedTo: priya.id, createdBy: james.id,
    dueDate: daysFromNow(9), estimatedHours: 20,
  })
  const t4 = await task({
    title: 'Speaker travel arrangements',
    description: 'Flights + hotels for 18 speakers. 12 confirmed, 6 pending visa dates.',
    priority: 'HIGH', status: 'BLOCKED', eventId: conf.id, assignedTo: omar.id, createdBy: maria.id,
    dueDate: daysFromNow(6), estimatedHours: 10,
  })
  const t5 = await task({
    title: 'Design conference badges & lanyards',
    priority: 'LOW', status: 'NOT_STARTED', eventId: conf.id, assignedTo: lena.id, createdBy: sofia.id,
    dueDate: daysFromNow(12), estimatedHours: 6,
  })
  const t6 = await task({
    title: 'Registration system load test',
    description: 'Simulate 2k concurrent check-ins on the QR scanner flow.',
    priority: 'HIGH', status: 'NOT_STARTED', eventId: conf.id, assignedTo: tom.id, createdBy: james.id,
    dueDate: daysFromNow(14), estimatedHours: 9,
  })
  const t7 = await task({
    title: 'Sponsor booth layout plan',
    description: '24 sponsor booths, power drops every second booth.',
    priority: 'MEDIUM', status: 'COMPLETED', eventId: conf.id, assignedTo: david.id, createdBy: maria.id,
    dueDate: daysAgo(3), estimatedHours: 7, actualHours: 6,
  })
  const t8 = await task({
    title: 'Confirm gala venue & decor theme',
    priority: 'HIGH', status: 'IN_PROGRESS', eventId: launch.id, assignedTo: sofia.id, createdBy: admin.id,
    dueDate: daysFromNow(18), estimatedHours: 10,
  })
  const t9 = await task({
    title: 'Press kit & media invitations',
    priority: 'MEDIUM', status: 'NOT_STARTED', eventId: launch.id, assignedTo: lena.id, createdBy: sofia.id,
    dueDate: daysFromNow(28), estimatedHours: 12,
  })
  const t10 = await task({
    title: 'Live demo station hardware order',
    priority: 'HIGH', status: 'BLOCKED', eventId: launch.id, assignedTo: tom.id, createdBy: james.id,
    dueDate: daysFromNow(20), estimatedHours: 5,
  })
  const t11 = await task({
    title: 'Hackathon judging rubric',
    priority: 'LOW', status: 'NOT_STARTED', eventId: hackathon.id, assignedTo: james.id, createdBy: james.id,
    dueDate: daysFromNow(60), estimatedHours: 4,
  })
  const t12 = await task({
    title: 'Route permits & road closure paperwork',
    priority: 'HIGH', status: 'COMPLETED', eventId: run.id, assignedTo: omar.id, createdBy: maria.id,
    dueDate: daysAgo(25), estimatedHours: 9, actualHours: 11,
  })
  const t13 = await task({
    title: 'Volunteer T-shirt distribution',
    priority: 'MEDIUM', status: 'COMPLETED', eventId: run.id, assignedTo: david.id, createdBy: maria.id,
    dueDate: daysAgo(16), estimatedHours: 5, actualHours: 4,
  })
  const t14 = await task({
    title: 'Workshop curriculum & lab environments',
    description: 'Three modules: APIs, integrations, admin console.',
    priority: 'HIGH', status: 'IN_PROGRESS', eventId: workshop.id, assignedTo: priya.id, createdBy: james.id,
    dueDate: daysFromNow(5), estimatedHours: 24,
  })
  const t15 = await task({
    title: 'Post-event survey & NPS report',
    priority: 'MEDIUM', status: 'COMPLETED', eventId: run.id, assignedTo: lena.id, createdBy: sofia.id,
    dueDate: daysAgo(8), estimatedHours: 6, actualHours: 5,
  })
  const t16 = await task({
    title: 'Draft workshop attendee email sequence',
    priority: 'LOW', status: 'IN_PROGRESS', eventId: workshop.id, assignedTo: lena.id, createdBy: sofia.id,
    dueDate: daysFromNow(2), estimatedHours: 4,
  })

  // ---------- Dependencies ----------
  await prisma.taskDependency.createMany({
    data: [
      { taskId: t3.id, dependsOnTaskId: t1.id }, // stream setup after venue booked
      { taskId: t6.id, dependsOnTaskId: t3.id }, // load test after stream pipeline
      { taskId: t5.id, dependsOnTaskId: t7.id }, // badges after layout plan
      { taskId: t9.id, dependsOnTaskId: t8.id }, // press kit after venue confirmed
    ],
  })

  // ---------- Comments ----------
  await prisma.taskComment.createMany({
    data: [
      { roomId: room.id, taskId: t4.id, userId: maria.id, content: 'Blocked on two speakers who need updated invitation letters for visas.', createdAt: daysAgo(2, 3) },
      { roomId: room.id, taskId: t4.id, userId: admin.id, content: 'Escalating with the travel agency today. Keep the backup speaker list warm.', createdAt: daysAgo(1, 5) },
      { roomId: room.id, taskId: t2.id, userId: david.id, content: 'Tasting scheduled Thursday — vegan menu looks promising with vendor #2.', createdAt: daysAgo(1, 2) },
      { roomId: room.id, taskId: t3.id, userId: priya.id, content: 'Encoder config done. Failover test planned for Friday with the venue IT.', createdAt: daysAgo(0, 6) },
      { roomId: room.id, taskId: t14.id, userId: priya.id, content: 'Module 1 lab environment is ready; modules 2-3 in review.', createdAt: daysAgo(0, 2) },
      { roomId: room.id, taskId: t16.id, userId: lena.id, content: 'Draft sequence in review — 3 emails, 5-day drip.', createdAt: daysAgo(0, 1) },
    ],
  })

  // ---------- Notifications ----------
  await prisma.notification.createMany({
    data: [
      { userId: omar.id, type: 'TASK_ASSIGNED', message: 'You were assigned "Speaker travel arrangements" (High priority)', createdAt: daysAgo(3) },
      { userId: priya.id, type: 'TASK_ASSIGNED', message: 'You were assigned "Set up live-stream pipeline"', createdAt: daysAgo(5) },
      { userId: tom.id, type: 'TASK_BLOCKED', message: 'Task "Live demo station hardware order" is blocked — awaiting budget approval', createdAt: daysAgo(1, 4) },
      { userId: maria.id, type: 'TASK_COMPLETED', message: 'David completed "Sponsor booth layout plan"', createdAt: daysAgo(2, 1) },
      { userId: david.id, type: 'DEADLINE_APPROACHING', message: '"Catering tasting & menu selection" is due in 4 days', createdAt: daysAgo(0, 3) },
      { userId: james.id, type: 'COMMENT_ADDED', message: 'Priya commented on "Set up live-stream pipeline"', createdAt: daysAgo(0, 6) },
      { userId: sofia.id, type: 'TASK_ASSIGNED', message: 'You were assigned "Confirm gala venue & decor theme"', createdAt: daysAgo(7) },
      { userId: lena.id, type: 'DEADLINE_APPROACHING', message: '"Draft workshop attendee email sequence" is due in 2 days', createdAt: daysAgo(0, 1) },
    ],
  })

  // ---------- Activity log ----------
  await prisma.activityLog.createMany({
    data: [
      { roomId: room.id, userId: admin.id, action: 'EVENT_CREATED', details: JSON.stringify({ eventName: conf.name }), timestamp: daysAgo(25) },
      { roomId: room.id, userId: maria.id, action: 'TASK_COMPLETED', details: JSON.stringify({ taskTitle: t1.title }), timestamp: daysAgo(9, 2) },
      { roomId: room.id, userId: david.id, action: 'TASK_COMPLETED', details: JSON.stringify({ taskTitle: t7.title }), timestamp: daysAgo(3) },
      { roomId: room.id, userId: maria.id, action: 'TASK_STATUS_CHANGED', details: JSON.stringify({ taskTitle: t4.title, from: 'IN_PROGRESS', to: 'BLOCKED' }), timestamp: daysAgo(2, 3) },
      { roomId: room.id, userId: james.id, action: 'EVENT_CREATED', details: JSON.stringify({ eventName: hackathon.name }), timestamp: daysAgo(10) },
      { roomId: room.id, userId: priya.id, action: 'TASK_STATUS_CHANGED', details: JSON.stringify({ taskTitle: t3.title, from: 'NOT_STARTED', to: 'IN_PROGRESS' }), timestamp: daysAgo(4) },
      { roomId: room.id, userId: sofia.id, action: 'EVENT_UPDATED', details: JSON.stringify({ eventName: launch.name }), timestamp: daysAgo(1, 7) },
      { roomId: room.id, userId: lena.id, action: 'COMMENT_ADDED', details: JSON.stringify({ taskTitle: t16.title }), timestamp: daysAgo(0, 1) },
      { roomId: room.id, userId: admin.id, action: 'TEAM_CREATED', details: JSON.stringify({ teamName: marketing.name }), timestamp: daysAgo(55) },
      { roomId: room.id, userId: priya.id, action: 'TASK_STATUS_CHANGED', details: JSON.stringify({ taskTitle: t14.title, from: 'NOT_STARTED', to: 'IN_PROGRESS' }), timestamp: daysAgo(1, 2) },
    ],
  })

  console.log('✅ Seed complete:')
  console.log(`   Teams: 3 | Users: 9 | Events: 6 | Tasks: 16`)
  console.log('   Demo login → admin@eventship.io / password123')
  console.log('   Demo room join → EVT-DEM258 / demo1234')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
