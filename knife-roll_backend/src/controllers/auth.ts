import express, { Response, Request } from 'express'
import { LoginSchema } from '../utils/schemas'
import { validateInput } from '../utils/middleware'
import { prisma } from '../utils/db'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { AppError } from '../utils/middleware'
import { config } from '../utils/config'

export const authRouter = express.Router()

// US-5: Log in
authRouter.post('/login', validateInput(LoginSchema), async (req: Request, res: Response) => {
    const { email, password } = req.body
    const user = await prisma.user.findUnique({
        where: {
            email
        }
    })

    if (!user) {
        throw new AppError(401, 'invalid email or password')
    }

    const match = await bcrypt.compare(password, user.password)
    if (!match) {
        throw new AppError(401, 'invalid email or password')
    }

    if (user.mustChangePassword) {
        req.log.debug('implement redirect for password change')
    }

    const payload = { id: user.id, email: user.email, admin: user.admin }

    const token = jwt.sign(payload, config.JWT_SECRET!, {
        expiresIn: '60min'
    })

    res.json({
        token, mustChangePassword: user.mustChangePassword, user: {
            id: user.id,
            email: user.email,
            name: user.name,
            admin: user.admin,
        }
    })
})
//
// // US-19: Logout (nice to have)
// authRouter.post('/logout', async (req: Request, res: Response) => {
//     // TODO: Implement logout
//     // - Invalidate token (if using blocklist)
//     // - Return 204
// })
//
// // US-19: Refresh token (nice to have)
// authRouter.post('/refresh', async (req: Request, res: Response) => {
//     // TODO: Implement refresh
//     // - Validate refresh token
//     // - Issue new access token + refresh token
//     // - Invalidate old refresh token
//     // - Return { token, refreshToken }
// })
