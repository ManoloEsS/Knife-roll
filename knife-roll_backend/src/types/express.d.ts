import jwt from 'jsonwebtoken'

export interface UserPayload {
  id: number
  email: string
  name: string
  admin: boolean
}

declare global {
  namespace Express {
    interface Request {
      user: UserPayload
    }
  }
}
