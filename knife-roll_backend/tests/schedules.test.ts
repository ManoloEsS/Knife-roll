import { app, connectDb, disconnectDb, clearDb, createAdmin } from './helpers/setup'
import supertest from 'supertest'
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'

const api = supertest(app)

beforeAll(connectDb)
afterAll(async () => {
    await clearDb()
    await disconnectDb()
})

describe('/api/schedules', () => {
    let userId: number

    beforeEach(async () => {
        await clearDb()
        const user = await createAdmin()
        userId = user.id
    })

    it('creates a valid schedule /POST', async () => {
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

    it('rejects missing startDate /POST', async () => {
        const response = await api
            .post('/api/schedules')
            .send({
                endDate: '2026-05-11',
                createdBy: userId,
            })
            .expect(400)

        expect(response.body.error).toBeDefined()
    })

    it('rejects missing endDate /POST', async () => {
        const response = await api
            .post('/api/schedules')
            .send({
                startDate: '2026-05-05',
                createdBy: userId,
            })
            .expect(400)

        expect(response.body.error).toBeDefined()
    })

    it('rejects endDate before startDate /POST', async () => {
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

    it('rejects invalid date format /POST', async () => {
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

    it('rejects non-existent createdBy user /POST', async () => {
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

    it('ignores extra fields /POST', async () => {
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

    it('retrieve empty schedule array /GET', async () => {
        const responseGet = await api
            .get('/api/schedules')
            .expect(200)

        expect(responseGet.body).toMatchObject([])
    })

    it('retrieve valid schedule /GET', async () => {
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

    it('rejects non-integer createdBy /POST', async () => {
    })

    it('accepts startDate equal to endDate /POST', async () => {
    })

    it('rejects non-integer createdBy /POST', async () => {
    })

    it('accepts startDate equal to endDate /POST', async () => {
    })

    it('retrieve valid schedule list /GET', async () => {
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

    it('deletes an existing schedule /DELETE', async () => {
    })

    it('returns 404 when deleting non-existent schedule /DELETE', async () => {
    })

    it('returns searched for schedule /GET', async () => {
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

        const searchResult = await api
            .get('/api/schedules/search?startDate=2026-05-05')
            .expect(200)

        expect(searchResult.body).toHaveLength(1)
        expect(searchResult.body[0]).toMatchObject(responsePostFirst.body)
        expect(searchResult.body).not.toContainEqual(expect.objectContaining({ id: responsePostSecond.body.id }))


    })

    it('returns empty array for no results /GET', async () => {
        const searchResult = await api
            .get('/api/schedules/search?startDate=2026-05-05')
            .expect(200)

        expect(searchResult.body).toHaveLength(0)

    })

    it('returns 400 with invalid date query /GET', async () => {
        await api
            .get('/api/schedules/search?startDate=2026-25-05')
            .expect(400)

    })
})
