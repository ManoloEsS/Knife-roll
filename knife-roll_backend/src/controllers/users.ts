import express, { Response, Request } from 'express'
import { prisma } from '../utils/db'
import { validate } from '../utils/middleware'
import { CreateUserSchema } from '../utils/schemas'
import bcrypt from 'bcrypt'

export const usersRouter = express.Router()


usersRouter.get('/', async (_req: Request, res: Response) => {
    const users = await prisma.user.findMany()
    res.json(users)
})

usersRouter.post('/', validate(CreateUserSchema), async (req: Request, res: Response) => {
    const defaultPassword = process.env.DEFAULT_PASSWORD
    if (!defaultPassword) {
        return res.status(500).json({ error: 'Default password not configured' })
    }
    const defaultPassHash = await bcrypt.hash(defaultPassword, 12)

    const { name, email, admin } = req.body
    const user = await prisma.user.create({ data: { name, email, admin, password: defaultPassHash } })
    const { password, ...userWithoutPassword } = user

    res.status(201).json(userWithoutPassword)
})
