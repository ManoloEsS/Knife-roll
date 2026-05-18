
export interface UserPayload {
    id: number
    email: string
    name: string
    admin: boolean
}

declare global {
    // eslint-disable-next-line no-unused-vars
    namespace Express {
        // eslint-disable-next-line no-unused-vars
        interface Request {
            user?: UserPayload
            token?: string
        }
    }
}
