import morgan from 'morgan'
import { NextFunction, Request, Response } from 'express'
import { Prisma } from '../generated/prisma/client'
import { z } from 'zod'

morgan.token('body', (req: Request) => {
    if (!req.body || typeof req.body !== 'object') {
        return ''
    }
    return JSON.stringify(req.body)
})

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'POST') {
        morgan(':method :url :status :res[content-length] - :response-time ms :body')(req, res, next)
    } else {
        morgan('tiny')(req, res, next)
    }
}

export const unknownEndpoint = (_req: Request, res: Response) => {
    res.status(404).send({ error: 'unknown endpoint' })
}

export const errorHandler = (error: Error, _req: Request, res: Response, next: NextFunction) => {
    console.error(error.message)

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
    next(error)
}

export const validate = (schema: z.ZodSchema) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const parsed = schema.safeParse(req.body)
        if (!parsed.success) {
            return res.status(400).json({ error: z.treeifyError(parsed.error) })
        }
        req.body = parsed.data
        next()
    }
}
