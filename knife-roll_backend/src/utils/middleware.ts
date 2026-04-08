import morgan from 'morgan'
import { NextFunction, Request, Response } from 'express'

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

    if (error.name === 'CastError') {
        return res.status(400).send({ error: 'malformatted id' })
    } else if (error.name === 'ValidationError') {
        return res.status(400).json({ errors: error.message })
    }
    next(error)
}
