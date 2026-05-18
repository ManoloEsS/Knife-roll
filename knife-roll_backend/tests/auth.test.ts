import { api, connectDb, disconnectDb, clearDb, createAdmin } from './helpers/setup'
import { expect, describe, it, beforeAll, afterAll, beforeEach } from 'vitest'

beforeAll(connectDb)

afterAll(async () => {
    await clearDb()
    await disconnectDb()
})

describe('/api/auth/login', () => {
    let email: string
    beforeEach(async () => {
        await clearDb()
        const admin = await createAdmin()
        email = admin.email
    })

    it('logs in with valid credentials /POST', async () => {
        await api
            .post('/api/auth/login')
            .send({
                email,
                password: process.env.DEFAULT_PASSWORD!,
            })
            .expect(200)
    })

    it('returns unauthorized status with non existent email /POST', async () => {
        await api
            .post('/api/auth/login')
            .send({
                email: 'non@existent.com',
                password: process.env.DEFAULT_PASSWORD!,
            })
            .expect(401)
    })

    it('returns unauthorized status with invalid password /POST', async () => {
        await api
            .post('/api/auth/login')
            .send({
                email,
                password: 'wrongpass',
            })
            .expect(401)
    })

    it('returns error when invalid login schema /POST', async () => {
        await api
            .post('/api/auth/login')
            .send({
                email,
            })
            .expect(400)
    })

    it('returns correct shape in response /POST', async () => {
        const response = await api
            .post('/api/auth/login')
            .send({
                email,
                password: process.env.DEFAULT_PASSWORD!,
            })
            .expect(200)

        expect(response.body).toMatchObject({
            token: expect.any(String),
            mustChangePassword: true,
            user: {
                id: expect.any(Number),
                email: 'admin@test.com',
                name: 'Admin',
                admin: true,
            },
        })
    })
})