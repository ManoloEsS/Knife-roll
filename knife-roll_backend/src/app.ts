import express from 'express'
import { unknownEndpoint, errorHandler, tokenExtractor, userExtractor } from './utils/middleware'
import { router } from './controllers/index'
import { healthRouter } from './controllers/health'
import { usersRouter } from './controllers/users'
import { schedulesRouter } from './controllers/schedules'
import { stationsRouter } from './controllers/stations'
import { authRouter } from './controllers/auth'
import { meRouter } from './controllers/me'
import { httpLogger } from './utils/logger'

export const app = express()

app.use(express.static('dist/public'))
app.use(express.json())
app.use(httpLogger)

app.use('/', router)
app.use('/health', healthRouter)
app.use('/api/users', tokenExtractor, userExtractor, usersRouter)
app.use('/api/schedules', tokenExtractor, userExtractor, schedulesRouter)
app.use('/api/stations', tokenExtractor, userExtractor, stationsRouter)
app.use('/api/auth', authRouter)
app.use('/api/me', tokenExtractor, userExtractor, meRouter)


app.use(unknownEndpoint)
app.use(errorHandler)
