import express, { Response, Request } from 'express'
import { prisma } from '../utils/db'
import { validateInputSchema } from '../utils/middleware'
import { CreateUserSchema } from '../utils/schemas'
import bcrypt from 'bcrypt'
import { z } from 'zod'

const userIdSchema = z.object({
    id: z.coerce.number().int().positive(),
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

usersRouter.post('/', validateInputSchema(CreateUserSchema), async (req: Request, res: Response) => {
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

// US-6: Change password
usersRouter.post('/:id/password', async (req: Request, res: Response) => {
    // TODO: Implement (US-6)
    // - Validate id from params
    // - Validate request body with ChangePasswordSchema
    // - Requires authenticated user (JWT middleware)
    // - :id must match authenticated user's ID (can only change own password)
    // - Find user by ID
    // - Compare currentPassword with stored hash using bcrypt
    // - Return 401 if currentPassword is incorrect
    // - Hash newPassword and update user
    // - Set mustChangePassword to false
    // - Return 204
    res.status(501).json({ error: 'Not implemented' })
})

// US-12: Update employee info
usersRouter.patch('/:id', async (req: Request, res: Response) => {
    // TODO: Implement (US-12)
    // - Validate id from params
    // - Validate request body with UpdateUserSchema
    // - At least one field required (email, name, admin, basePayRate)
    // - Find user by ID, return 404 if not found
    // - Update user fields
    // - Return 200 with updated user (without password)
    res.status(501).json({ error: 'Not implemented' })
})

