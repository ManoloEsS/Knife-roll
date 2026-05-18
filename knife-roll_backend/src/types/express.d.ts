import { User } from "../generated/prisma/client"

export interface UserPayload {
  id: number
  email: string
  name: string
  admin: boolean
}

declare global {
  namespace Express {
    interface Request {
      user?: User
      token?: string
    }
  }
}
