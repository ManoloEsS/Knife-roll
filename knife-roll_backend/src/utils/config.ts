export const config = {
    PORT: process.env.PORT || 3001,
    DATABASE_URL: process.env.DATABASE_URL,
    DB_SSL: process.env.DB_SSL === 'false' ? false : true,
    JWT_SECRET: process.env.JWT_SECRET,
}

export function validateConfig() {
    const missing: string[] = []
    if (!config.DATABASE_URL) missing.push('DATABSE_URL')
    if (!config.JWT_SECRET) missing.push('JWT_SECRET')
    if (missing.length > 0) {
        throw new Error(`Missing environment variables: ${missing.join(', ')}`)
    }
}
