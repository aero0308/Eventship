import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
const deps = await db.taskDependency.findMany({
  include: { task: { select: { title: true } }, dependsOnTask: { select: { title: true } } },
})
for (const d of deps) console.log(`${d.task.title}  ->  ${d.dependsOnTask.title}`)
await db.$disconnect()
