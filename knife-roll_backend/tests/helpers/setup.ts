import { prisma } from '../../src/utils/db'
import bcrypt from 'bcrypt'
import type { User } from '../../src/generated/prisma/client'

export { app } from '../../src/app'

export const connectDb = async () => {
    await prisma.$connect()
}

export const disconnectDb = async () => {
    await prisma.$disconnect()
}

export const clearDb = async () => {
    await prisma.shift.deleteMany()
    await prisma.schedule.deleteMany()
    await prisma.station.deleteMany()
    await prisma.user.deleteMany()
}

export const createAdmin = async (): Promise<User> => {
    const passwordHash = await bcrypt.hash(process.env.DEFAULT_PASSWORD!, 12)
    return await prisma.user.create({
        data: { email: 'admin@test.com', name: 'Admin', admin: true, password: passwordHash },
    })
}
