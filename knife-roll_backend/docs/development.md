# Development Guide - Knife Roll Backend

This document explains the architectural decisions made during the initial setup of the backend, particularly around Prisma, TypeScript configuration, and the production build structure.

## Table of Contents

- [Database Connection (Prisma 7)](#database-connection-prisma-7)
- [Using Prisma Client in Routes](#using-prisma-client-in-routes)
- [Error Handling](#error-handling)
- [Router Structure](#router-structure)
- [Request Validation (Zod)](#request-validation-zod)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Static File Serving & Security](#static-file-serving--security)
- [TypeScript Configuration](#typescript-configuration)
- [Database Migrations](#database-migrations)
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

Import the `prisma` singleton from `src/utils/db.ts` and use it in your routes. Routes are defined in sub-router files under `src/controllers/`:

```ts
// controllers/users.ts
import { prisma } from '../utils/db'
import { validate } from '../utils/middleware'
import { CreateUserSchema } from '../utils/schemas'

usersRouter.get('/', async (_req, res) => {
    const users = await prisma.user.findMany()
    res.json(users)
})

usersRouter.post('/', validate(CreateUserSchema), async (req, res) => {
    const user = await prisma.user.create({ data: req.body })
    res.status(201).json(user)
})
```

For POST routes, the `validate()` middleware runs first. If the request body doesn't match the schema, it returns a 400 error. If valid, `req.body` is replaced with parsed data and the route handler runs.

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

## Router Structure

### /api Prefix

All API routes are mounted under `/api` in `app.ts`:

```ts
app.use('/api', router)
```

This separates API routes from static frontend files. Static assets are served from `dist/public/`, and API routes are always accessed via `/api/*`. This prevents conflicts between frontend paths (e.g., `/users`) and API paths (e.g., `/api/users`).

### Sub-Routers per Resource

Each resource has its own router file in `src/controllers/`. The main router (`controllers/index.ts`) is a barrel file that imports and mounts all sub-routers:

```ts
// controllers/index.ts
import express from 'express'
import { healthRouter } from './health'
import { usersRouter } from './users'
import { schedulesRouter } from './schedules'
import { shiftsRouter } from './shifts'
import { stationsRouter } from './stations'

export const router = express.Router()

router.use('/health', healthRouter)
router.use('/users', usersRouter)
router.use('/schedules', schedulesRouter)
router.use('/shifts', shiftsRouter)
router.use('/stations', stationsRouter)
```

### Route Table

| Method | Full URL | Handler File | Description |
|---|---|---|---|
| GET | `/api/health` | `health.ts` | Health check |
| GET | `/api/users` | `users.ts` | List all users |
| GET | `/api/users/:id` | `users.ts` | Get user by ID |
| POST | `/api/users` | `users.ts` | Create a user |
| GET | `/api/schedules` | `schedules.ts` | List all schedules (with shifts and user) |
| GET | `/api/schedules/:id` | `schedules.ts` | Get schedule by ID (with shifts) |
| POST | `/api/schedules` | `schedules.ts` | Create a schedule |
| GET | `/api/shifts` | `shifts.ts` | List all shifts (with schedule, user, station) |
| GET | `/api/shifts/:id` | `shifts.ts` | Get shift by ID |
| POST | `/api/shifts` | `shifts.ts` | Create a shift |
| PATCH | `/api/shifts/:id/pickup` | `shifts.ts` | Pick up a shift (assign user) |
| GET | `/api/stations` | `stations.ts` | List all stations (with shifts) |
| POST | `/api/stations` | `stations.ts` | Create a station |

### Why Sub-Routers?

- **Separation of concerns**: Each file handles one resource. Easy to find, easy to maintain.
- **Barrel file pattern**: `controllers/index.ts` is the single import source for `app.ts`. Adding a new router means creating a file and adding one line to the barrel file.
- **Route prefix isolation**: Inside `users.ts`, routes are defined relative to `/users` (`router.get('/')`, `router.get('/:id')`). The full path is determined by where the router is mounted in `index.ts`.
- **Middleware per route**: Validation middleware is applied per route: `router.post('/', validate(CreateUserSchema), async (req, res) => { ... })`.

### Middleware Chain in Routes

Express processes route handlers left to right. The `validate()` middleware runs before the route handler:

```ts
router.post('/', validate(CreateUserSchema), async (req, res) => {
    // validate() already ran — req.body is parsed and type-safe
    const user = await prisma.user.create({ data: req.body })
    res.status(201).json(user)
})
```

If validation fails, `validate()` sends a 400 response and the route handler never runs. If validation passes, `req.body` is replaced with parsed data (including defaults) and `next()` calls the route handler.

---

## Request Validation (Zod)

### Why Zod?

[Zod](https://zod.dev) is a TypeScript-first schema validation library used to validate incoming request bodies. It provides:

- **Runtime validation**: Catches missing or invalid fields before they reach Prisma
- **Type inference**: Zod schemas automatically infer TypeScript types — no need to maintain separate type definitions
- **Structured error messages**: Validation errors are returned as a tree structure via `z.treeifyError()`
- **Defaults**: Fields like `admin: z.boolean().default(false)` are set automatically

### Why Not Use Prisma Types Directly?

Prisma generates types like `Prisma.UserCreateInput`, but these include all fields (including `id`, `createdAt`, `scheduledHours`). Using them as request body types would allow clients to send fields they shouldn't (over-posting). Zod schemas define exactly what the API accepts — the single source of truth for input validation.

### Schema Definitions

All Zod schemas are defined in `src/utils/schemas.ts`:

```ts
import { z } from 'zod'

export const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  admin: z.boolean().default(false),
})

export const CreateScheduleSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  createdBy: z.number().int(),
})

export const CreateShiftSchema = z.object({
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  scheduleId: z.number().int(),
  stationName: z.string(),
  available: z.boolean().default(true),
})

export const PickUpShiftSchema = z.object({
  userId: z.number().int(),
})

export const CreateStationSchema = z.object({
  name: z.string().min(1),
})
```

**Key decisions:**
- `id` and `createdAt` are NOT in schemas — they're auto-generated by the database
- `createdBy` on Schedule accepts a user ID (until auth is added, then it will come from the session)
- `userId` on Shift is NOT in `CreateShiftSchema` — shifts are created unassigned and picked up via `PATCH /api/shifts/:id/pickup`
- `z.string().datetime()` validates ISO 8601 datetime strings; Prisma converts them to `DateTime`
- `available` defaults to `true` via `z.boolean().default(true)`

### The validate() Middleware

The `validate()` function in `src/utils/middleware.ts` is a factory that takes a Zod schema and returns Express middleware:

```ts
import { z } from 'zod'

export const validate = (schema: z.ZodSchema) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const parsed = schema.safeParse(req.body)
        if (!parsed.success) {
            return res.status(400).json({ error: z.treeifyError(parsed.error) })
        }
        req.body = parsed.data
        next()
    }
}
```

Flow:
1. `safeParse()` validates `req.body` against the schema — returns `{ success: true, data }` or `{ success: false, error }`
2. If invalid → returns 400 with the error tree, route handler never runs
3. If valid → `req.body` is replaced with parsed data (including applied defaults like `admin: false`), then `next()` calls the route handler

**Note:** `z.treeifyError()` is the Zod v4 way to format errors. The v3 method `parsed.error.flatten()` is deprecated.

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
│   ├── schema.prisma          # Prisma schema (models, generator, datasource)
│   └── migrations/            # Database migration files (committed to git)
├── prisma.config.ts            # Prisma CLI config (datasource URL for CLI commands)
├── src/
│   ├── generated/
│   │   └── prisma/             # Prisma generated client (gitignored)
│   ├── controllers/
│   │   ├── index.ts            # Barrel file — re-exports and mounts sub-routers
│   │   ├── health.ts           # GET /api/health
│   │   ├── users.ts           # /api/users routes
│   │   ├── schedules.ts       # /api/schedules routes
│   │   ├── shifts.ts          # /api/shifts routes
│   │   └── stations.ts        # /api/stations routes
│   ├── utils/
│   │   ├── config.ts           # PORT, dotenv setup
│   │   ├── db.ts               # PrismaClient instance (adapter pattern)
│   │   ├── logger.ts           # Logging utility
│   │   ├── middleware.ts        # Express middleware (requestLogger, errorHandler, validate)
│   │   └── schemas.ts          # Zod validation schemas
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
- **API routes**: Mounted at `/api` via `app.use('/api', router)`

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
| `/api/users` | Route handler | Express router at `/api` |
| `/api/schedules` | Route handler | Express router at `/api` |
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

## Logging: Pino over Morgan

**Decision:** We replaced Morgan with Pino (`pino` + `pino-http`). Morgan only formats strings — it logs method, path, status, and response time as plain text, with no structured logging or log-level filtering. `pino-http` does everything Morgan does (method, path, status, response time) but with structured JSON output and proper log levels. Pino also includes `pino-pretty` for human-readable dev output and supports multi-transport targets (e.g., debug to console, info+ to file), matching the pattern used in other services.

```ts
import pino from 'pino'
import pinoHttp from 'pino-http'

const logger = pino({ level: 'debug' })
app.use(pinoHttp({ logger }))
```

For development, `pino-pretty` provides Morgan-style readability:

```ts
const logger = pino({
  level: 'debug',
  transport: {
    targets: [
      { target: 'pino-pretty', level: 'debug' },
      { target: 'pino/file', options: { destination: './app.log' }, level: 'info' }
    ]
  }
})
```

---

## Authentication: JWT Strategy

**Decision:** JWT authentication uses a "fail closed" middleware pattern. All protected routes require valid authentication; requests without a valid token receive a `401 Unauthorized` response and the request is halted.

### Why "Fail Closed" Over "Fail Open"

We explicitly chose **not** to use the "fail open" pattern (setting `req.user = null` and continuing) because:

1. **Security by default** — Protected routes cannot be accessed without valid authentication
2. **No boilerplate in handlers** — Route handlers don't need to check `if (!req.user)` on every request
3. **Prevents accidental leaks** — Easy to forget auth checks; middleware enforces it centrally

### Middleware Flow

```ts
// validateJWT middleware
if (!authHeader || !authHeader.startsWith("Bearer ")) {
  return next(new AppError(401, 'Not authorized')) // halt request
}

try {
  const decoded = jwt.verify(token, JWT_SECRET)
  req.user = decoded as UserPayload // attach typed user
  next() // continue to handler
} catch (err) {
  return next(new AppError(401, 'Not authorized')) // halt on invalid/expired
}
```

### Token Structure

- **Payload:** `{ id: number, email: string, name: string, admin: boolean }`
- **Expiration:** 60 minutes
- **Storage:** Client-side (not persisted in DB — stateless JWT)
- **Transport:** `Authorization: Bearer <token>` header

### Type Safety

User payload is typed via declaration merging in `src/types/express.d.ts`:

```ts
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
```

---

## TODO: Render Deployment Setup

- [ ] Add `db:deploy:prod` script (`prisma migrate deploy` without dotenv)
- [ ] Add `start:prod` script (`npx prisma migrate deploy && node dist/index.js`)
- [ ] Add `prisma generate` to the build process
- [ ] Configure Render environment variables (`DATABASE_URL`, `PORT`)
- [ ] Set up Render build command (may need monorepo-specific adjustments)
- [ ] Review `prisma.config.ts` behavior without `.env` file
- [ ] Test the full deployment flow on Render

## TODO: Replace Morgan with Pino

- [ ] Install `pino` and `pino-http` (replace `morgan` and `@types/morgan`)
- [ ] Rewrite `src/utils/logger.ts` — export a pino logger instance with structured JSON output
- [ ] Replace `requestLogger` middleware with `pino-http` in `src/utils/middleware.ts`
- [ ] Remove morgan import and custom `:body` token logic
- [ ] Replace all `console.log` / `console.error` calls with pino logger methods
- [ ] Add `pino-pretty` as dev dependency for human-readable dev output
- [ ] Update `package.json` scripts if needed for dev/production log config
- [ ] Remove `morgan` and `@types/morgan` from dependencies