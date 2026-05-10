import express, { Response, Request } from 'express'
import { prisma } from '../utils/db'
import { validate } from '../utils/middleware'
import { CreateStationSchema } from '../utils/schemas'

export const stationsRouter = express.Router()

stationsRouter.get('/', async (_req: Request, res: Response) => {
    const stations = await prisma.station.findMany()

    res.json(stations)
})

stationsRouter.post('/', validate(CreateStationSchema), async (req: Request, res: Response) => {
    const { name } = req.body
    const station = await prisma.station.create({ data: { name } })
    res.status(201).json(station)
})

stationsRouter.delete('/:name', async (req: Request, res: Response) => {
    const name = req.params.name as string

    await prisma.station.deleteMany({ where: { name } })

    res.status(204).end()

})
