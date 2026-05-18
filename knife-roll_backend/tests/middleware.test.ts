import { api, connectDb, disconnectDb, clearDb, createAdmin, getAuthToken } from './helpers/setup'
import { describe, it, beforeAll, afterAll, beforeEach } from 'vitest'

let token: string

beforeAll(connectDb)
afterAll(async () => {
    await clearDb()
    await disconnectDb()
})

describe('middleware test', () => {
    beforeEach(async () => {
        await clearDb()
        const _user = await createAdmin()
        token = await getAuthToken()
    })

    it('fails to extract jwt, no auth header', async () => {
        const _response = await api
            .get('/api/users')
            .expect(401)
    })

    it('fails to extract jwt, no Bearer', async () => {
        const _response = await api
            .get('/api/users')
            .set('Authorization', `${token}`)
            .expect(401)
    })

    it('invalid jwt token', async () => {
        const _response = await api
            .get('/api/users')
            .set('Authorization', 'Bearer wrongToken')
            .expect(401)
    })

})
