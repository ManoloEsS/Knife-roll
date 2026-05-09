import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        setupFiles: ['./tests/helpers/setup.ts'],
        include: ['tests/**/*.test.ts'],
        env: {
            DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/knife_roll_test',
            DB_SSL: 'false',
        },
    },
})