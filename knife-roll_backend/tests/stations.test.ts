import { api, connectDb, disconnectDb, clearDb, createAdmin, getAuthToken } from './helpers/setup'
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'

let token: string

beforeAll(connectDb)

afterAll(async () => {
    await clearDb()
    await disconnectDb()
})

describe('/api/stations', () => {

    beforeEach(async () => {
        await clearDb()
        await createAdmin()
        token = await getAuthToken()
    })

    it('creates a valid station', async () => {
        const response = await api
            .post('/api/stations')
            .set('Authorization', `Bearer ${token}`)
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
                .set('Authorization', `Bearer ${token}`)
                .send({
                    name: s
                })
                .expect(201)
        }

        const stations = await api
            .get('/api/stations')
            .set('Authorization', `Bearer ${token}`)
            .expect(200)

        expect(stations.body.sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name)))
            .toMatchObject([{ name: 'grill' }, { name: 'pantry' }, { name: 'sautee' }])

    })

    it('retrieve empty stations array', async () => {
        const response = await api
            .get('/api/stations')
            .set('Authorization', `Bearer ${token}`)
            .expect(200)

        expect(response.body).toMatchObject([])
    })

    // it('deletes an existing station', async () => {
    //     await api
    //         .post('/api/stations')
    //         .set('Authorization', `Bearer ${token}`)
    //         .send({
    //             name: 'grill'
    //         })
    //         .expect(201)
    //
    //     await api
    //         .delete('/api/stations/grill')
    //         .expect(204)
    //
    //     const validate = await api
    //         .get('/api/stations')
    //         .expect(200)
    //
    //     expect(validate.body).not.toContainEqual({ name: 'grill' })
    // })
    //
    // it('returns 204 when deleting non existent station', async () => {
    //     await api
    //         .delete('/api/stations/grill')
    //         .expect(204)
    //
    //     const validate = await api
    //         .get('/api/stations')
    //         .expect(200)
    //
    //     expect(validate.body).not.toContainEqual({ name: 'grill' })
    //
    // })

    // US-17: Update station
    // it('updates a station /PATCH', async () => {
    //     // TODO: Implement (US-17)
    // })
    //
    // // US-3: Delete station by id
    // it('deletes a station by id /DELETE', async () => {
    //     // TODO: Implement (US-3)
    // })

})