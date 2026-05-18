import { api, connectDb, disconnectDb, clearDb, createAdmin, getAuthToken } from './helpers/setup'
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'

let token: string

beforeAll(connectDb)

afterAll(async () => {
    await clearDb()
    await disconnectDb()
})

describe('/api/users', () => {
    beforeEach(async () => {
        await clearDb()
        await createAdmin()
        token = await getAuthToken()
    })

    it('creates a valid user /POST', async () => {
        const response = await api
            .post('/api/users')
            .set('Authorization', `Bearer ${token}`)
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

    it('gets a single user /GET', async () => {
        const response = await api
            .post('/api/users')
            .set('Authorization', `Bearer ${token}`)
            .send({
                email: 'test@test.com',
                name: 'Test User',
                admin: false,
            })
            .expect(201)

        const id = response.body.id
        const userResponse = await api
            .get(`/api/users/${id}`)
            .set('Authorization', `Bearer ${token}`)
            .expect(200)

        const { id: userId, email, name, admin } = response.body
        expect(userResponse.body).toEqual({ id: userId, email, name, admin })
        expect(userResponse.body.password).toBeUndefined()
    })

    it('gets an array of users /GET', async () => {
        const firstResponse = await api
            .post('/api/users')
            .set('Authorization', `Bearer ${token}`)
            .send({
                email: 'test1@test.com',
                name: 'Test User',
                admin: false,
            })
            .expect(201)

        const secondResponse = await api
            .post('/api/users')
            .set('Authorization', `Bearer ${token}`)
            .send({
                email: 'test2@test.com',
                name: 'Test User',
                admin: false,
            })
            .expect(201)

        const users = await api
            .get('/api/users')
            .set('Authorization', `Bearer ${token}`)
            .expect(200)

        expect(users.body).toHaveLength(3)
        expect(users.body[0].password).toBeUndefined()

        const { id: idFirst, name: nameFirst, email: emailFirst, admin: adminFirst } = firstResponse.body
        expect(users.body).toContainEqual({ id: idFirst, name: nameFirst, email: emailFirst, admin: adminFirst })
        const { id: idSecond, name: nameSecond, email: emailSecond, admin: adminSecond } = secondResponse.body
        expect(users.body).toContainEqual({ id: idSecond, name: nameSecond, email: emailSecond, admin: adminSecond })

    })

    // US-6: Change password
    it('changes password /POST', async () => {
        // TODO: Implement (US-6)
    })

    // US-12: Update employee info
    it('updates employee info /PATCH', async () => {
        // TODO: Implement (US-12)
    })

})