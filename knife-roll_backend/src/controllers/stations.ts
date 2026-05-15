import express, { Response, Request } from 'express'
import { prisma } from '../utils/db'
import { validateInput } from '../utils/middleware'
import { CreateStationSchema } from '../utils/schemas'
import { z } from 'zod'

const _stationIdSchema = z.object({
    id: z.coerce.number().int().positive(),
})

const _stationNameSchema = z.object({
    name: z.string().min(1),
})

export const stationsRouter = express.Router()

stationsRouter.get('/', async (_req: Request, res: Response) => {
    const stations = await prisma.station.findMany()

    res.json(stations)
})

stationsRouter.post('/', validateInput(CreateStationSchema), async (req: Request, res: Response) => {
    const { name } = req.body
    const station = await prisma.station.create({ data: { name } })
    res.status(201).json(station)
})

// US-3: Delete station by id
// stationsRouter.delete('/:id', async (req: Request, res: Response) => {
//     // TODO: Implement (US-3)
//     // - Validate id from params
//     // - Delete station by id
//     // - Prisma onDelete: Restrict on Shift→Station means deleting a station
//     //   with existing shifts will fail (P2003) — client should reassign shifts first
//     // - Return 204, or 404 if not found
// })
//
// // US-17: Update station
// stationsRouter.patch('/:name', async (req: Request, res: Response) => {
//     // TODO: Implement (US-17)
//     // - Validate name from params
//     // - Validate request body with UpdateStationSchema (name: z.string().min(1))
//     // - Find station by name, return 404 if not found
//     // - Update station name (Prisma handles cascade on FK)
//     // - Return 200 with updated station
// })

stationsRouter.post('/', validateInput(CreateStationSchema), async (req: Request, res: Response) => {
    const { name } = req.body
    const station = await prisma.station.create({ data: { name } })
    res.status(201).json(station)
})

stationsRouter.delete('/:name', async (req: Request, res: Response) => {
    const name = req.params.name as string

    await prisma.station.deleteMany({ where: { name } })

    res.status(204).end()

})
