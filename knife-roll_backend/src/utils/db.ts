import { PrismaClient } from '../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import { logger } from './logger'

export let prisma: PrismaClient

export const initDb = async (dbUrl: string, dbSsl: boolean) => {
    const pool = new pg.Pool({
        connectionString: dbUrl,
        ssl: dbSsl,
    })

    const adapter = new PrismaPg(pool)
    prisma = new PrismaClient({ adapter })
    await prisma.$connect()
    logger.info('Successfully connected to db')
}
