import express, { Response, Request } from 'express'

export const healthRouter = express.Router()

healthRouter.get('/', (req: Request, res: Response) => {
    res.json({ status: 'ok' })
})
