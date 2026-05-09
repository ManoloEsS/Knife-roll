import { app, connectDb, disconnectDb, clearDb, createAdmin } from './helpers/setup'
import supertest from 'supertest'
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'

const api = supertest(app)

describe('POST /api/schedules', () => {
    let userId: number

    beforeAll(connectDb)

    afterAll(disconnectDb)

    beforeEach(async () => {
        await clearDb()
        const user = await createAdmin()
        userId = user.id
    })

    it('creates a valid schedule', async () => {
        const response = await api
            .post('/api/schedules')
            .send({
                startDate: '2026-05-05',
                endDate: '2026-05-11',
                createdBy: userId,
            })
            .expect(201)

        expect(response.body).toHaveProperty('id')
        expect(response.body.startDate).toBeDefined()
        expect(response.body.endDate).toBeDefined()
        expect(response.body.createdBy).toBe(userId)
    })

    it('rejects missing startDate', async () => {
        const response = await api
            .post('/api/schedules')
            .send({
                endDate: '2026-05-11',
                createdBy: userId,
            })
            .expect(400)

        expect(response.body.error).toBeDefined()
    })

    it('rejects missing endDate', async () => {
        const response = await api
            .post('/api/schedules')
            .send({
                startDate: '2026-05-05',
                createdBy: userId,
            })
            .expect(400)

        expect(response.body.error).toBeDefined()
    })

    it('rejects endDate before startDate', async () => {
        const response = await api
            .post('/api/schedules')
            .send({
                startDate: '2026-05-11',
                endDate: '2026-05-05',
                createdBy: userId,
            })
            .expect(400)

        expect(response.body.error).toBeDefined()
    })

    it('rejects invalid date format', async () => {
        const response = await api
            .post('/api/schedules')
            .send({
                startDate: 'not-a-date',
                endDate: '2026-05-11',
                createdBy: userId,
            })
            .expect(400)

        expect(response.body.error).toBeDefined()
    })

    it('rejects non-existent createdBy user', async () => {
        const response = await api
            .post('/api/schedules')
            .send({
                startDate: '2026-05-05',
                endDate: '2026-05-11',
                createdBy: 999,
            })
            .expect(400)

        expect(response.body.error).toBeDefined()
    })

    it('ignores extra fields', async () => {
        const response = await api
            .post('/api/schedules')
            .send({
                startDate: '2026-05-05',
                endDate: '2026-05-11',
                createdBy: userId,
                foo: 'bar',
            })
            .expect(201)

        expect(response.body).toHaveProperty('id')
        expect(response.body.foo).toBeUndefined()
    })
})

describe('GET /api/schedules', () => {
    let userId: number

    beforeAll(connectDb)

    afterAll(disconnectDb)

    beforeEach(async () => {
        await clearDb()
        const user = await createAdmin()
        userId = user.id
    })

    it('retrieve empty schedule array', async () => {
        const responseGet = await api
            .get('/api/schedules')
            .expect(200)

        expect(responseGet.body).toMatchObject([])
    })

    it('retrieve valid schedule', async () => {
        const responsePost = await api
            .post('/api/schedules')
            .send({
                startDate: '2026-05-05',
                endDate: '2026-05-11',
                createdBy: userId,
            })
            .expect(201)

        const responseGet = await api
            .get('/api/schedules')
            .expect(200)

        expect(responseGet.body[0]).toMatchObject(responsePost.body)

    })

    it('retrieve valid schedule list', async () => {
        const responsePostFirst = await api
            .post('/api/schedules')
            .send({
                startDate: '2026-05-05',
                endDate: '2026-05-11',
                createdBy: userId,
            })
            .expect(201)

        const responsePostSecond = await api
            .post('/api/schedules')
            .send({
                startDate: '2026-06-05',
                endDate: '2026-06-11',
                createdBy: userId,
            })
            .expect(201)

        const responseGet = await api
            .get('/api/schedules')
            .expect(200)

        expect(responseGet.body.sort((a, b) => a.startDate.localeCompare(b.startDate)))
            .toMatchObject([responsePostFirst.body, responsePostSecond.body])
    })
})
