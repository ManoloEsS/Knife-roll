import express, { Response, Request } from 'express'
import { prisma } from '../utils/db'
import { validate } from '../utils/middleware'
import { CreateUserSchema } from '../utils/schemas'

export const usersRouter = express.Router()

usersRouter.get('/', async (_req: Request, res: Response) => {
    const users = await prisma.user.findMany()
    res.json(users)
})

usersRouter.post('/', validate(CreateUserSchema), async (req: Request, res: Response) => {
    const { name, email, admin } = req.body
    const user = await prisma.user.create({ data: { name, email, admin } })
    res.status(201).json(user)
})
