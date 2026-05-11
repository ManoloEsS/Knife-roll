import { app, connectDb, disconnectDb, clearDb, createAdmin } from './helpers/setup'
import supertest from 'supertest'
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'

const api = supertest(app)

beforeAll(connectDb)
afterAll(async () => {
    await clearDb()
    await disconnectDb()
})

describe('/api/users', () => {
    beforeEach(async () => {
        await clearDb()
        await createAdmin()
    })

    it('creates a valid user /POST', async () => {
        const response = await api
            .post('/api/users')
            .send({
                email: 'test@test.com',
                name: 'Test User',
                admin: false,
            })
            .expect(201)

        expect(response.body).toHaveProperty('id')
        expect(response.body.email).toBe('test@test.com')
        expect(response.body.name).toBe('Test User')
        expect(response.body.admin).toBe(false)
        expect(response.body.password).toBeUndefined()
    })
})