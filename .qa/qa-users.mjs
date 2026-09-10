import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
const users = await db.user.findMany({ select: { email: true, strictDependencyGuard: true } })
console.log(JSON.stringify(users))
await db.$disconnect()
