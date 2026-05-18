import { NextFunction, Request, Response } from 'express'
import { Prisma } from '../generated/prisma/client'
import { z } from 'zod'
import jwt from 'jsonwebtoken'
import { config } from './config'
import { UserPayload } from '../types/express'
import { prisma } from './db'

export class AppError extends Error {
    statusCode: number
    constructor(statusCode: number, message: string) {
        super(message)
        this.statusCode = statusCode
    }
}

export const unknownEndpoint = (_req: Request, res: Response) => {
    res.status(404).send({ error: 'unknown endpoint' })
}

export const errorHandler = (error: Error, req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof AppError) {
        req.log.warn({ err: error }, error.message)
        return res.status(error.statusCode).json({ error: error.message })
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        req.log.warn({ err: error }, error.code)
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'Duplicate entry', fields: error.meta?.target })
        }
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Record not found' })
        }
        if (error.code === 'P2003') {
            return res.status(400).json({ error: 'Foreign key constraint failed' })
        }
    }

    req.log.error(error, 'unexpected error')
    return res.status(500).json({ error: 'internal server error' })
}

export const validateInput = (schema: z.ZodSchema) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const parsed = schema.safeParse(req.body)
        if (!parsed.success) {
            return res.status(400).json({ error: z.treeifyError(parsed.error) })
        }
        req.body = parsed.data
        next()
    }
}

const getTokenFrom = (request: Request): string | null => {
    const authorization = request.get('Authorization')
    if (authorization && authorization.startsWith('Bearer ')) {
        return authorization.replace('Bearer ', '')
    }
    return null
}

export const tokenExtractor = (req: Request, _res: Response, next: NextFunction) => {
    const token = getTokenFrom(req)
    req.token = token ?? undefined

    next()
}

export const userExtractor = async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.token) {
        throw new AppError(401, 'Not authorized')
    }
    let decoded: UserPayload
    try {
        decoded = jwt.verify(req.token, config.JWT_SECRET!) as UserPayload
    } catch (err) {
        req.log.error({ err }, 'JWT error')
        throw new AppError(401, 'Not authorized')
    }

    if (!decoded.id) {
        throw new AppError(401, 'Not authorized')
    }

    const user = await prisma.user.findUnique({
        where: {
            id: decoded.id
        }
    })

    if (!user) {
        throw new AppError(401, 'User not found')
    }

    req.user = user

    next()
}
