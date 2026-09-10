import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
const tasks = await db.task.findMany({ where: { status: { in: ['IN_PROGRESS','NOT_STARTED'] } }, select: { id: true, title: true, status: true } })
console.log(JSON.stringify(tasks))
await db.$disconnect()
