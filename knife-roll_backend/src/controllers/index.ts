import express, { Response, Request } from 'express'
import { prisma } from '../utils/db'

export const router = express.Router()

router.get('/', (_req: Request, res: Response) => {
    console.log('GET /')
    res.json({ message: 'API is running' })
})

// router.get('/health', (_req: Request, res: Response) => {
//     console.log('GET /health')
//     res.json({ status: 'ok' })
// })


// router.get('/users', async (_req: Request, res: Response) => {
//     const users = await prisma.user.findMany()
//     res.json(users)
// })
