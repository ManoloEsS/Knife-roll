import { NextFunction, Request, Response } from 'express'
import { Prisma } from '../generated/prisma/client'
import { z } from 'zod'

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

export const errorHandler = (error: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof AppError) {
        return res.status(error.statusCode).json({ error: error.message })
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
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