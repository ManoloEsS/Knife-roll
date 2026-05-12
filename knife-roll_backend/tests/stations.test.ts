import { app, connectDb, disconnectDb, clearDb, createAdmin } from './helpers/setup'
import supertest from 'supertest'
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'

const api = supertest(app)

beforeAll(connectDb)

afterAll(async () => {
    await clearDb()
    await disconnectDb()
})

describe('/api/stations', () => {

    beforeEach(async () => {
        await clearDb()
        await createAdmin()
    })

    it('creates a valid station', async () => {
        const response = await api
            .post('/api/stations')
            .send({
                name: 'grill'
            })
            .expect(201)

        expect(response.body).toHaveProperty('id')
        expect(response.body).toMatchObject({ name: 'grill' })
    })

    it('gets all stations', async () => {
        for (const s of ['grill', 'sautee', 'pantry']) {
            await api
                .post('/api/stations')
                .send({
                    name: s
                })
                .expect(201)
        }

        const stations = await api
            .get('/api/stations')
            .expect(200)

        expect(stations.body.sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name)))
            .toMatchObject([{ name: 'grill' }, { name: 'pantry' }, { name: 'sautee' }])

    })

    it('retrieve empty stations array', async () => {
        const response = await api
            .get('/api/stations')
            .expect(200)

        expect(response.body).toMatchObject([])
    })

    it('deletes an existing station', async () => {
        await api
            .post('/api/stations')
            .send({
                name: 'grill'
            })
            .expect(201)

        await api
            .delete('/api/stations/grill')
            .expect(204)

        const validate = await api
            .get('/api/stations')
            .expect(200)

        expect(validate.body).not.toContainEqual({ name: 'grill' })
    })

    it('returns 204 when deleting non existent station', async () => {
        await api
            .delete('/api/stations/grill')
            .expect(204)

        const validate = await api
            .get('/api/stations')
            .expect(200)

        expect(validate.body).not.toContainEqual({ name: 'grill' })

    })

})
