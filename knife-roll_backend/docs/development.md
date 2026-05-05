# Development Guide - Knife Roll Backend

This document explains the architectural decisions made during the initial setup of the backend, particularly around Prisma, TypeScript configuration, and the production build structure.

## Table of Contents

- [Database Connection (Prisma 7)](#database-connection-prisma-7)
- [Using Prisma Client in Routes](#using-prisma-client-in-routes)
- [Error Handling](#error-handling)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Static File Serving & Security](#static-file-serving--security)
- [TypeScript Configuration](#typescript-configuration)
- [NPM Scripts Explained](#npm-scripts-explained)

---

## Database Connection (Prisma 7)

### Prisma Config vs Schema

In Prisma 7, the `url` property was **removed from `schema.prisma`**. Database URLs are now configured in two places:

1. **`prisma.config.ts`** — Used by Prisma CLI commands (migrations, db push, generate). Defines the `datasource.url` for CLI operations.
2. **PrismaClient constructor** — Used at runtime by the application. The database URL is passed via a driver adapter, not via the schema.

### Prisma Generated Output

The Prisma client output is configured in `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}
```

**Decision:** We moved the output from the default `../generated/prisma` (project root) to `../src/generated/prisma` (inside `src/`). This was chosen because:

- All compilable TypeScript lives under `src/`, keeping the project structure clean.
- The `tsconfig.json` `rootDir` stays as `"./src"`, which means compiled output maps cleanly: `src/utils/db.ts` → `dist/utils/db.js`, `src/generated/prisma/client.ts` → `dist/generated/prisma/client.js`.
- Import paths are short and natural: `import { PrismaClient } from '../generated/prisma/client'`.
- No changes needed to `package.json` `main` or `start` script.

### Driver Adapter (pg)

The database connection uses `@prisma/adapter-pg` with the `pg` driver:

```ts
import { PrismaClient } from '../generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
export const prisma = new PrismaClient({ adapter })
```

This is required because Prisma 7 no longer auto-connects from a schema URL. The adapter pattern gives explicit control over the database connection pool.

---

## Using Prisma Client in Routes

### How It Works

After running `npx prisma generate`, Prisma reads your `schema.prisma` models and generates a fully type-safe client in `src/generated/prisma/`. Each model in your schema gets a set of built-in methods that return Promises.

For example, with the `User` model:

```prisma
model User {
  id Int @id @default(autoincrement())
  email String @unique
  name String?
  admin Boolean
}
```

Prisma generates `prisma.user` with methods like:

| Method | Returns | Description |
|---|---|---|
| `findMany()` | `Promise<User[]>` | Get all users |
| `findUnique({ where: { id } })` | `Promise<User \| null>` | Get one user by ID or unique field |
| `create({ data: {...} })` | `Promise<User>` | Create a new user |
| `update({ where: {...}, data: {...} })` | `Promise<User>` | Update a user |
| `delete({ where: { id } })` | `Promise<User>` | Delete a user |

All methods return Promises, so route handlers using them must be `async`.

### Route Handler Pattern

Import the `prisma` singleton from `src/utils/db.ts` and use it in your routes:

```ts
import { prisma } from '../utils/db'

router.get('/users', async (_req: Request, res: Response) => {
    const users = await prisma.user.findMany()
    res.json(users)
})
```

### No Try/Catch Needed (Express 5)

This project uses Express 5 (`express@5.2.1`), which **automatically catches rejected Promises** in async route handlers. If `prisma.user.findMany()` throws an error, Express 5 forwards it to the error handler middleware — no try/catch needed.

```ts
// This is sufficient in Express 5:
router.get('/users', async (_req, res) => {
    const users = await prisma.user.findMany()
    res.json(users)
})

// No need for this:
router.get('/users', async (_req, res, next) => {
    try {
        const users = await prisma.user.findMany()
        res.json(users)
    } catch (error) {
        next(error) // Express 5 does this automatically
    }
})
```

The error will be caught by the `errorHandler` middleware defined in `src/utils/middleware.ts`.

---

## Error Handling

### Original Error Handler (Mongoose-Specific)

The project's original error handler was written for a MongoDB/Mongoose backend:

```ts
export const errorHandler = (error: Error, _req: Request, res: Response, next: NextFunction) => {
    console.error(error.message)

    if (error.name === 'CastError') {
        return res.status(400).send({ error: 'malformatted id' })
    } else if (error.name === 'ValidationError') {
        return res.status(400).json({ errors: error.message })
    }
    next(error)
}
```

`CastError` and `ValidationError` are Mongoose-specific and won't occur with Prisma/PostgreSQL.

### Updated Error Handler (Prisma-Specific)

Prisma throws `PrismaClientKnownRequestError` with specific error codes:

| Code | HTTP Status | Meaning |
|---|---|---|
| `P2002` | 409 | Unique constraint violation (e.g., duplicate email) |
| `P2025` | 404 | Record not found |
| `P2003` | 400 | Foreign key constraint failure |

The updated error handler should handle these Prisma-specific errors:

```ts
import { Prisma } from '../generated/prisma/client'

export const errorHandler = (error: Error, _req: Request, res: Response, next: NextFunction) => {
    console.error(error.message)

    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
            return res.status(409).json({ error: 'Duplicate entry', fields: error.meta?.target })
        }
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Record not found' })
        }
        if (error.code === 'P2003') {
            return res.status(400).json({ error: 'Foreign key constraint failed' })
        }
    }

    next(error)
}
```

**Decision:** We chose to switch to Prisma-specific error handling because the original Mongoose errors are irrelevant to a PostgreSQL backend. The error handler catches known Prisma error codes and returns appropriate HTTP statuses, while unknown errors are forwarded to the next handler.

**Note:** The `PrismaClientKnownRequestError` class is accessed via the `Prisma` namespace (`Prisma.PrismaClientKnownRequestError`), not as a direct named export from the generated client. This is the Prisma 7 pattern.

---

## Environment Variables

### Development

The `dev` and `dev:full` scripts use `dotenv-cli` to load `.env.development`:

```json
"dev": "dotenv -e .env.development -- tsx watch src/index.ts"
```

This injects `DATABASE_URL` (local Docker PostgreSQL) into the environment before the process starts.

Additionally, `src/utils/config.ts` calls `dotenv.config()` which loads `.env` if it exists. In development, `.env` contains a Prisma Cloud URL, but the `dotenv -e` wrapper overrides it with `.env.development` values.

### Production

The `start` script runs `node dist/index.js` with no `dotenv-cli` wrapper. The application relies on `dotenv.config()` in `src/utils/config.ts` to load `.env`, which contains the production database URL (Prisma Cloud).

| Environment | Script | Env file loaded | DATABASE_URL |
|---|---|---|---|
| Development | `npm run dev:full` | `dotenv -e .env.development` | `postgresql://postgres:postgres@localhost:5432/postgres?sslmode=disable` |
| Production | `npm run start` | `dotenv.config()` (loads `.env`) | `postgres://...@db.prisma.io:5432/postgres?sslmode=require` |

---

## Project Structure

```
knife-roll_backend/
├── prisma/
│   └── schema.prisma          # Prisma schema (models, generator, datasource)
├── prisma.config.ts            # Prisma CLI config (datasource URL for CLI commands)
├── src/
│   ├── generated/
│   │   └── prisma/             # Prisma generated client (gitignored)
│   ├── controllers/
│   │   └── index.ts            # API routes
│   ├── utils/
│   │   ├── config.ts           # PORT, dotenv setup
│   │   ├── db.ts               # PrismaClient instance (adapter pattern)
│   │   ├── logger.ts           # Logging utility
│   │   └── middleware.ts        # Express middleware
│   ├── app.ts                  # Express app setup
│   └── index.ts                # Entry point
├── dist/                        # Compiled output (gitignored)
│   ├── public/                  # Frontend static assets (served by Express)
│   │   ├── index.html
│   │   └── assets/
│   ├── index.js                 # Backend entry (NOT publicly served)
│   ├── utils/
│   └── controllers/
├── .env                         # Production environment variables (gitignored)
├── .env.development             # Development environment variables (gitignored)
└── package.json
```

---

## Static File Serving & Security

### The Problem

Originally, Express served the entire `dist/` folder via `express.static('dist')`. This meant compiled backend JavaScript files were publicly accessible via URLs like `/index.js` or `/utils/db.js`, potentially exposing database connection logic.

### The Solution

We separated frontend and backend output:

- **Frontend** (Vite): Builds into `dist/public/` via `vite.config.ts` `outDir`
- **Backend** (TypeScript): Compiles into `dist/` (top level)
- **Express**: Serves only `dist/public/` via `express.static('dist/public')`

This way, only frontend static assets (HTML, CSS, JS bundles) are publicly accessible. Backend server code lives in `dist/` but outside `dist/public/`, so it's never served as a static file.

### Build Commands

```json
"build": "npx tsc",
"build:ui": "cd ../knife-roll_frontend/ && npm run build",
"build:full": "rm -rf dist && npm run build:ui && npm run build"
```

The `build:full` command:
1. Cleans the `dist/` directory
2. Builds the frontend into `dist/public/`
3. Compiles the backend into `dist/`

### URL Behavior

| URL | Serves | Why |
|---|---|---|
| `/` | `dist/public/index.html` | Express static middleware |
| `/assets/app.js` | `dist/public/assets/app.js` | Express static middleware |
| `/api/items` | Route handler | Express router |
| `/index.js` | 404 (unknown endpoint) | NOT in `dist/public/` |
| `/utils/db.js` | 404 (unknown endpoint) | NOT in `dist/public/` |

---

## TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "esnext",
    "module": "commonjs",
    "rootDir": "./src",
    "outDir": "./dist",
    "strict": true,
    "moduleResolution": "node",
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["./src/**/*.ts"],
  "exclude": ["node_modules"]
}
```

**Decision:** `rootDir` is set to `"./src"` which produces a flat output structure under `dist/`. The Prisma generated client is inside `src/generated/prisma/`, so TypeScript resolves it naturally and compiles it to `dist/generated/prisma/`.

We chose not to expand `rootDir` to `"."` because:
- `src/` → `dist/` mapping is the standard TypeScript project layout
- The `package.json` `main` field (`dist/index.js`) and `start` script stay simple
- Import paths are short: `../generated/prisma/client` instead of `../../generated/prisma/client`

---

## Database Migrations

### db push vs migrate

This project uses `prisma migrate dev` instead of `prisma db push` for schema changes. The difference:

| | `db push` | `migrate dev` |
|---|---|---|
| What it does | Syncs schema directly to DB | Generates a SQL migration file, then applies it |
| History | No record of changes | Migration files committed to git |
| Rollback | Manual | Can review SQL before applying |
| Production | Risky — no tracking | Safe — `migrate deploy` applies known SQL files |
| Team collaboration | No migration files to share | Migration files committed and shared |

### Development workflow

1. Start the database and dev server: `npm run dev:full`
2. Edit `prisma/schema.prisma` when you need to change the database schema
3. Run `npm run db:migrate` — Prisma will:
   - Compare your schema to the database
   - Prompt for a migration name
   - Generate a SQL file in `prisma/migrations/<timestamp>_<name>/migration.sql`
   - Apply the migration to the database
   - Regenerate the Prisma client automatically
4. Commit the new migration directory to git

### Production deployment

```bash
npm run db:deploy   # applies pending migrations (non-interactive)
npm run build:full  # builds frontend + backend
npm run start       # starts the server
```

`db:deploy` uses `prisma migrate deploy` which only applies migrations that haven't been run yet. It never prompts, never resets data, and is safe for production.

### Existing migrations

This project already has two baseline migrations:

- `20260408021606_init` — Creates the `User` table (id, email, name)
- `20260408023239_base_user` — Adds the `admin` column to `User`

All future schema changes should create new migrations via `npm run db:migrate`.

---

## NPM Scripts Explained

| Script | Command | Purpose |
|---|---|---|
| `dev:full` | `npm run db:start && npm run db:generate && npm run dev` | Start DB, generate client, start dev server |
| `dev` | `dotenv -e .env.development -- nodemon --watch src --ext ts --exec tsx src/index.ts` | Start dev server with hot reload |
| `db:start` | `docker start postgres18 \|\| docker run -d ...` | Start PostgreSQL Docker container |
| `db:migrate` | `dotenv -e .env.development -- prisma migrate dev` | Create & apply a migration (interactive) |
| `db:deploy` | `dotenv -e .env.development -- prisma migrate deploy` | Apply pending migrations (non-interactive, for production) |
| `db:generate` | `prisma generate` | Regenerate Prisma client from schema |
| `build` | `npx tsc` | Compile TypeScript to `dist/` |
| `build:ui` | `cd ../knife-roll_frontend/ && npm run build` | Build frontend into `dist/public/` |
| `build:full` | `rm -rf dist && npm run build:ui && npm run build` | Full production build |
| `start` | `node dist/index.js` | Start production server |

---

## TODO: Render Deployment Setup

- [ ] Add `db:deploy:prod` script (`prisma migrate deploy` without dotenv)
- [ ] Add `start:prod` script (`npx prisma migrate deploy && node dist/index.js`)
- [ ] Add `prisma generate` to the build process
- [ ] Configure Render environment variables (`DATABASE_URL`, `PORT`)
- [ ] Set up Render build command (may need monorepo-specific adjustments)
- [ ] Review `prisma.config.ts` behavior without `.env` file
- [ ] Test the full deployment flow on Render