# Development Setup Guide

## Prerequisites

- Node.js (v22+)
- Docker (for local Postgres)
- PostgreSQL client (optional, for debugging)

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start local Postgres (see Database section)
docker start postgres18

# 3. Run migrations on local database
npx dotenv-cli -e .env.development -- npx prisma migrate dev --name init

# 4. Start development server
npm run dev
```

Server runs at `http://localhost:3001`

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server with local DB (hot reload with tsx) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run build:ui` | Build frontend React app to `dist/` |
| `npm run build:full` | Build both backend and frontend |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |

## Database Commands

```bash
# Run migrations (when schema changes)
npx dotenv-cli -e .env.development -- npx prisma migrate dev --name your_change

# Reset database (WARNING: deletes all data)
npx dotenv-cli -e .env.development -- npx prisma migrate reset

# Check migration status
npx dotenv-cli -e .env.development -- npx prisma migrate status

# Push schema without migrations (quick prototyping)
npx dotenv-cli -e .env.development -- npx prisma db push

# Generate Prisma client
npx dotenv-cli -e .env.development -- npx prisma generate
```

## Environment Files

Two environment files control which database is used:

| File | Purpose | Usage |
|------|---------|-------|
| `.env` | Production database | Used by default, deployed to Render |
| `.env.development` | Local database | Used with `npm run dev` |

### .env (Production)

```env
DATABASE_URL="postgresql://..."
```

### .env.development (Local)

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres?sslmode=disable"
```

## Local Postgres Setup

### Create volume (one-time)

```bash
docker volume create knife_roll_dev
```

### Start the container

```bash
# Start existing container
docker start postgres18

# Or create a new one with named volume
docker run -d \
  --name postgres18 \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=postgres \
  -v knife_roll_dev:/var/lib/postgresql \
  -p 5432:5432 \
  postgres:18
```

### Manage volumes

```bash
# List volumes
docker volume ls

# Inspect volume
docker volume inspect knife_roll_dev

# Delete volume (WARNING: deletes all data)
docker volume rm knife_roll_dev
```

### Connect to the database

```bash
# Via docker exec
docker exec -it postgres18 psql -U postgres -d postgres

# Or via psql directly (if installed)
psql -h localhost -U postgres -d postgres
```

### Useful psql commands

```sql
-- List tables
\dt

-- List all databases
\l

-- Describe a table
\d "User"

-- Check migration status
SELECT * FROM _prisma_migrations;

-- Drop all tables (reset)
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
```

### Stop the container

```bash
docker stop postgres18
```

Data persists in the Docker volume, so you can stop and start without losing data.

## Project Structure

```
knife-roll_backend/
├── src/
│   ├── app.ts          # Express app setup
│   ├── index.ts        # Server entry point
│   ├── controllers/    # Route handlers
│   └── utils/          # Helpers (config, logger, middleware)
├── prisma/
│   ├── schema.prisma   # Database schema
│   └── migrations/     # Migration files
├── generated/
│   └── prisma/         # Generated Prisma client
├── dist/               # Compiled JS output (gitignored)
├── .env                # Production env vars (gitignored)
├── .env.development    # Local env vars (gitignored)
└── development/        # This guide
```

## Workflow Summary

1. **Start of day:**
   ```bash
   docker start postgres18
   npm run dev
   ```

2. **When schema changes:**
   ```bash
   # Edit prisma/schema.prisma
   npx dotenv-cli -e .env.development -- npx prisma migrate dev --name describe_change
   ```

3. **End of day:**
   ```bash
   docker stop postgres18
   ```

## Troubleshooting

### "Cannot connect to database"
- Is Docker running?
- Is `postgres18` container started? (`docker ps`)

### "Migration out of sync"
```bash
npx dotenv-cli -e .env.development -- npx prisma migrate reset
```

### "Port already in use"
```bash
lsof -i :3001
kill <PID>
```

### "Module not found"
```bash
npm install
npx prisma generate
```
