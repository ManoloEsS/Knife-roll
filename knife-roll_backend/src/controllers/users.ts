import express, { Response, Request } from 'express'
import { prisma } from '../utils/db'
import { validate } from '../utils/middleware'
import { CreateUserSchema } from '../utils/schemas'
import bcrypt from 'bcrypt'
import { z } from 'zod'

const userIdSchema = z.object({
    id: z.coerce.number(),
})
export const usersRouter = express.Router()


usersRouter.get('/', async (_req: Request, res: Response) => {
    const users = await prisma.user.findMany({
        select: { id: true, name: true, email: true, admin: true }
    })

    res.json(users)
})

usersRouter.get('/:id', async (req: Request, res: Response) => {
    const parsed = userIdSchema.safeParse(req.params)
    if (!parsed.success) {
        return res.status(400).json({ error: z.treeifyError(parsed.error) })
    }

    const { id } = parsed.data
    const user = await prisma.user.findUnique({
        where: { id },
        select: { id: true, name: true, email: true, admin: true }
    })

    if (!user) {
        return res.status(404).json({ error: 'User not found' })
    }


    res.json(user)
})

usersRouter.post('/', validate(CreateUserSchema), async (req: Request, res: Response) => {
    const defaultPassword = process.env.DEFAULT_PASSWORD
    if (!defaultPassword) {
        return res.status(500).json({ error: 'Default password not configured' })
    }
    const defaultPassHash = await bcrypt.hash(defaultPassword, 12)

    const { name, email, admin } = req.body
    const user = await prisma.user.create({ data: { name, email, admin, password: defaultPassHash } })
    const { password: _password, ...userWithoutPassword } = user

    res.status(201).json(userWithoutPassword)
})
