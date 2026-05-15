import { app } from './app'
import { config, validateConfig } from './utils/config'
import { initDb } from './utils/db'
import { logger } from './utils/logger'


const main = async () => {
    validateConfig()
    await initDb(config.DATABASE_URL!, config.DB_SSL)

    app.listen(config.PORT, () => {
        logger.info(`Server running on port ${config.PORT}`)
    })
}

main().catch((err) => {
    logger.fatal(err, 'startup failed')
    setTimeout(() => process.exit(1), 100)
})
