import express, { Response, Request } from 'express'
import { prisma } from '../utils/db'
import { validate } from '../utils/middleware'
import { CreateScheduleSchema } from '../utils/schemas'
import { z } from 'zod'

const dateQuerySchema = z.object({
    startDate: z.iso.date(),
})

export const schedulesRouter = express.Router()

schedulesRouter.get('/', async (_req: Request, res: Response) => {
    const schedules = await prisma.schedule.findMany()

    res.json(schedules)
})

schedulesRouter.get('/search', async (req: Request, res: Response) => {
    const parsed = dateQuerySchema.safeParse(req.query)
    if (!parsed.success) {
        return res.status(400).json({ error: z.treeifyError(parsed.error) })
    }

    const { startDate } = parsed.data
    const startOfDay = new Date(startDate)
    const endOfDay = new Date(startOfDay)
    endOfDay.setDate(endOfDay.getDate() + 1)


    const schedules = await prisma.schedule.findMany({
        where: {
            startDate: {
                gte: startOfDay,
                lt: endOfDay,
            },
        },
    })

    res.json(schedules)

})

schedulesRouter.post('/', validate(CreateScheduleSchema), async (req: Request, res: Response) => {
    const { startDate, endDate, createdBy } = req.body

    const schedule = await prisma.schedule.create({
        data: {
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            createdBy,
        },
    })

    res.status(201).json(schedule)
})
