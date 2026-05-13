# Knife Roll Backend

A full-stack shift coverage app built for restaurant teams. Managers post open shifts, and available cooks are notified — but your sharpest, most reliable cooks get priority access before the shift goes to everyone else. Named after the chef's tool roll, because your best people are your sharpest knives.

## Data Model

```
User                Schedule              Shift              Station
─────                ─────────              ─────              ───────
id (PK)             id (PK)               id (PK)            id (PK)
email (unique)      startDate (unique)     shiftTime (enum)   name (unique)
name?               endDate                date               ← shifts
password            createdBy (FK→User)    scheduleId (FK)    
mustChangePassword  createdAt              userId? (FK)       
admin                                      stationName (FK)   
basePayRate                                status (enum)      
scheduledHours                             incentive?          
createdAt                                                      

enums: ShiftTime = breakfast | lunch | dinner
       ShiftStatus = available | assigned | pending
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/users` | List all users (password omitted) |
| GET | `/api/users/:id` | Get user by ID (password omitted) |
| POST | `/api/users` | Create user (hashes default password) |
| GET | `/api/schedules` | List all schedules |
| GET | `/api/schedules/search?startDate=` | Search schedules by start date |
| POST | `/api/schedules` | Create a schedule |
| POST | `/api/schedules/:startDate/shifts` | Create shift within a schedule |
| GET | `/api/stations` | List all stations |
| POST | `/api/stations` | Create a station |
| DELETE | `/api/stations/:name` | Delete a station |

## Getting Started

### Prerequisites

- Node.js v22+
- Docker (for local PostgreSQL)
- npm

### Setup

```bash
npm install
npm run db:start      # Start PostgreSQL container
npm run db:generate   # Generate Prisma client
npm run db:migrate    # Run migrations
npm run dev            # Start dev server (http://localhost:3001)
```

Or all at once: `npm run dev:full`

### Environment Variables

| Variable | Purpose | Dev Default |
|----------|---------|-------------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/postgres` |
| `DB_SSL` | Enable SSL (`false` for local) | `false` |
| `DEFAULT_PASSWORD` | Default password for new users | Set in `.env.development` |
| `PORT` | Server port | `3001` |

### Testing

```bash
npm test               # Generate client, run migrations, run tests
npm run test:watch      # Run tests in watch mode
```

Tests use a separate `knife_roll_test` database. Each test clears and reseeds all tables.

## Project Structure

```
knife-roll_backend/
├── src/
│   ├── app.ts                  # Express app setup & route mounting
│   ├── index.ts                # Server entry point
│   ├── controllers/
│   │   ├── health.ts           # GET /health
│   │   ├── users.ts            # User CRUD endpoints
│   │   ├── schedules.ts        # Schedule & shift endpoints
│   │   └── stations.ts         # Station CRUD endpoints
│   └── utils/
│       ├── config.ts           # PORT, dotenv setup
│       ├── db.ts               # PrismaClient (pg adapter)
│       ├── logger.ts           # Logging utility
│       ├── middleware.ts        # Request logger, error handler, validate()
│       └── schemas.ts          # Zod validation schemas
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── migrations/             # SQL migration files
├── tests/
│   ├── helpers/setup.ts        # Test DB setup, exports app & prisma
│   ├── users.test.ts
│   ├── schedules.test.ts
│   └── stations.test.ts
├── dist/                       # Compiled output (gitignored)
├── .env                        # Production env vars (gitignored)
├── .env.development            # Dev env vars (gitignored)
└── .env.test                   # Test env vars (gitignored)
```

## Detailed Docs

- [Development Setup Guide](development/README.md) — Docker, Prisma CLI, troubleshooting
- [Architecture & Decisions](docs/development.md) — Prisma 7, Express 5, Zod, project structure deep dive

## NPM Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `dotenv -e .env.development -- nodemon ... tsx src/index.ts` | Dev server with hot reload |
| `dev:full` | `db:start && db:generate && dev` | Start everything |
| `db:start` | `docker start postgres18 \|\| docker run ...` | Start Postgres container |
| `db:migrate` | `dotenv -e .env.development -- prisma migrate dev` | Create & apply migration |
| `db:generate` | `prisma generate` | Regenerate Prisma client |
| `build` | `npx tsc` | Compile TypeScript |
| `build:full` | `rm -rf dist && build:ui && build` | Full production build |
| `test` | `prisma generate && migrate deploy && vitest run` | Run test suite |
| `lint` | `eslint .` | Lint |