import express from 'express'
import { requestLogger, unknownEndpoint, errorHandler } from './utils/middleware'
import { router } from './controllers/index'
import { healthRouter } from './controllers/health'
import { usersRouter } from './controllers/users'
import { schedulesRouter } from './controllers/schedules'
import { stationsRouter } from './controllers/stations'
import { authRouter } from './controllers/auth'
import { shiftsRouter } from './controllers/shifts'
import { meRouter } from './controllers/me'

export const app = express()

app.use(express.static('dist/public'))
app.use(express.json())
app.use(requestLogger)

app.use('/', router)
app.use('/health', healthRouter)
app.use('/api/users', usersRouter)
app.use('/api/schedules', schedulesRouter)
app.use('/api/stations', stationsRouter)
app.use('/api/auth', authRouter)
app.use('/api/shifts', shiftsRouter)
app.use('/api/me', meRouter)


app.use(unknownEndpoint)
app.use(errorHandler)
