import express from 'express'
import { requestLogger, unknownEndpoint, errorHandler } from './utils/middleware'
import { router } from './controllers'

export const app = express()

app.use(express.static('dist/public'))
app.use(express.json())
app.use(requestLogger)

app.use('/', router)

app.use(unknownEndpoint)
app.use(errorHandler)
