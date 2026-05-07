import express from 'express'
import { requestLogger, unknownEndpoint, errorHandler } from './utils/middleware'
import { router } from './controllers/index'
import { healthRouter } from './controllers/health'
import { usersRouter } from './controllers/users'

export const app = express()

app.use(express.static('dist/public'))
app.use(express.json())
app.use(requestLogger)

app.use('/', router)
app.use('/health', healthRouter)
app.use('/users', usersRouter)


app.use(unknownEndpoint)
app.use(errorHandler)
