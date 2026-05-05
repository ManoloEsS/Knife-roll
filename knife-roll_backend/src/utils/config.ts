import dotenv from 'dotenv'
dotenv.config()

export const PORT = process.env.PORT || 3001

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not defined')
}

export const DATABASE_URL = process.env.DATABASE_URL
