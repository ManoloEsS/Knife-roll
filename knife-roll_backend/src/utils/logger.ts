import { Request } from 'express'
import pino from 'pino'
import PinoHttp from 'pino-http'

const streams = [
    { level: 'error', stream: pino.destination('./error.log') },
    { level: 'info', stream: pino.destination('./app.log') },
    {
        level: 'debug', stream: pino.transport({
            target: 'pino-pretty',
            options: { colorize: true }
        })
    },
]

export const logger = pino({
    level: 'debug',
    formatters: {
        level: (label) => {
            return { level: label.toUpperCase() }
        },
    },
    timestamp: pino.stdTimeFunctions.isoTime,
}, pino.multistream(streams))

export const httpLogger = PinoHttp<Request>({
    logger,
    customSuccessObject(req, _res, val) {
        return {
            ...val,
            body: req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0
                ? req.body
                : undefined,
        }
    },
    customErrorObject(_req, _res, error) {
        return { error: { message: error.message, name: error.name, stack: error.stack } }
    },
    serializers: {
        req(req) {
            return { method: req.method, url: req.url }
        },
        res(res) {
            const { headers, ...rest } = res
            const { 'x-powered-by': _, etag: __, 'content-type': ___, 'content-length': ____, ...cleanHeaders } = headers || {}
            return { ...rest, headers: cleanHeaders }
        },
    },
})
