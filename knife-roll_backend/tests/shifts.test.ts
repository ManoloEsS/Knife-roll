import { app, connectDb, disconnectDb, clearDb, createAdmin } from './helpers/setup'
import supertest from 'supertest'
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest'

const _api = supertest(app)

beforeAll(connectDb)

afterAll(async () => {
    await clearDb()
    await disconnectDb()
})

describe('/api/shifts', () => {
    beforeEach(async () => {
        await clearDb()
        await createAdmin()
    })

    it('updates a shift /PATCH', async () => {
        // TODO: Implement (US-7, US-8)
    })

    it('deletes a shift /DELETE', async () => {
        // TODO: Implement (US-11)
    })
})