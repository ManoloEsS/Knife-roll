import express, { Response, Request } from 'express'
import { prisma } from '../utils/db'
import { validateInputSchema } from '../utils/middleware'
import { CreateScheduleSchema, CreateShiftSchema } from '../utils/schemas'
import { z } from 'zod'

const dateQuerySchema = z.object({
    startDate: z.iso.date(),
})

const scheduleStartDateSchema = z.object({
    scheduleStartDate: z.iso.date(),
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

schedulesRouter.post('/', validateInputSchema(CreateScheduleSchema), async (req: Request, res: Response) => {
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

schedulesRouter.post('/:scheduleStartDate/shifts', validateInputSchema(CreateShiftSchema),
    async (req: Request, res: Response) => {
        const parsed = scheduleStartDateSchema.safeParse(req.params)
        if (!parsed.success) {
            return res.status(400).json({ error: z.treeifyError(parsed.error) })
        }

        const { scheduleStartDate } = parsed.data

        const startOfDay = new Date(scheduleStartDate)

        const schedule = await prisma.schedule.findUnique({
            where: {
                startDate: startOfDay,
            }
        })

        if (!schedule) {
            return res.status(404).json({ error: 'Schedule not found' })
        }



        if (new Date(req.body.date) < schedule.startDate || new Date(req.body.date) > schedule.endDate) {
            return res.status(400).json({ error: 'Shift date must be within schedule date' })
        }

        const shift = await prisma.shift.create({
            data: {
                shiftTime: req.body.shiftTime,
                date: new Date(req.body.date),
                stationName: req.body.stationName,
                incentive: req.body.incentive,
                userId: req.body.userId,
                status: req.body.status,
                scheduleId: schedule.id,
            }
        })

        res.status(201).json(shift)
    })
