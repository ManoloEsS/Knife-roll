import express, { Response, Request } from 'express'
// import { prisma } from '../utils/db'

export const healthRouter = express.Router()

healthRouter.get('/', (_req: Request, res: Response) => {
    console.log('GET /health')
    res.json({ status: 'ok' })
})
