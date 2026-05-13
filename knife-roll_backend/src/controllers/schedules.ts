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

const _scheduleIdSchema = z.object({
    id: z.coerce.number().int().positive(),
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

// US-9: Get single schedule with shifts
schedulesRouter.get('/:id', async (req: Request, res: Response) => {
    // TODO: Implement (US-9)
    // - Validate id from params
    // - Find schedule by ID with include: { shifts: true }
    // - Return 404 if not found
    // - Return schedule with nested shifts
    res.status(501).json({ error: 'Not implemented' })
})

// US-16: Update schedule
schedulesRouter.patch('/:id', async (req: Request, res: Response) => {
    // TODO: Implement (US-16)
    // - Validate id from params
    // - Validate request body with UpdateScheduleSchema
    // - At least one field required (startDate or endDate)
    // - If both provided, endDate >= startDate
    // - If only endDate, must be >= existing startDate
    // - If only startDate, must be <= existing endDate
    // - Find schedule by ID, return 404 if not found
    // - Update and return 200
    res.status(501).json({ error: 'Not implemented' })
})

// US-11: Delete schedule
schedulesRouter.delete('/:id', async (req: Request, res: Response) => {
    // TODO: Implement (US-11)
    // - Validate id from params
    // - Find schedule by ID, return 404 if not found
    // - If schedule has shifts and ?confirm=true not passed, return 409 with shiftCount
    // - If confirm=true or no shifts, delete and return 204
    // - Prisma onDelete: Cascade handles shift deletion
    res.status(501).json({ error: 'Not implemented' })
})
