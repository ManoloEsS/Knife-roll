import express, { Response, Request } from 'express'

export const router = express.Router()

router.get('/', (_req: Request, res: Response) => {
    console.log('GET /')
    res.json({ message: 'API is running' })
})

router.get('/health', (_req: Request, res: Response) => {
    console.log('GET /health')
    res.json({ status: 'ok' })
})
