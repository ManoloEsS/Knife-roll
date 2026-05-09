import express, { Response, Request } from 'express'
import { prisma } from '../utils/db'
import { validate } from '../utils/middleware'
import { CreateScheduleSchema } from '../utils/schemas'

export const schedulesRouter = express.Router()

schedulesRouter.get('/', async (_req: Request, res: Response) => {
    const schedules = await prisma.schedule.findMany()

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
