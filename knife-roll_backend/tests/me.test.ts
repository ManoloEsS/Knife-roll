import { connectDb, disconnectDb, clearDb, createAdmin, getAuthToken } from './helpers/setup'
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest'

let _token: string

beforeAll(connectDb)

afterAll(async () => {
    await clearDb()
    await disconnectDb()
})

describe('/api/me', () => {
    beforeEach(async () => {
        await clearDb()
        await createAdmin()
        _token = await getAuthToken()
    })

    it('returns authenticated user profile /GET', async () => {
        // TODO: Implement (US-18)
    })
})