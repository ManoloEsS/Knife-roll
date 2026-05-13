import { app, connectDb, disconnectDb, clearDb, createAdmin } from './helpers/setup'
import supertest from 'supertest'
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest'

const _api = supertest(app)

beforeAll(connectDb)

afterAll(async () => {
    await clearDb()
    await disconnectDb()
})

describe('/api/me', () => {
    beforeEach(async () => {
        await clearDb()
        await createAdmin()
    })

    it('returns authenticated user profile /GET', async () => {
        // TODO: Implement (US-18)
    })
})