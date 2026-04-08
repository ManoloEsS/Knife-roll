# Knife Roll - Project Plan

## 1. Overview

**Knife Roll** is a restaurant back-of-house scheduling system where cooks pick their own shifts based on a merit-based scoring system. The "sharpest" knives (top performers) get first pick at the best shifts.

### Core Concept
- Chefs create and release weekly schedules
- Cooks pick shifts based on their score (calculated from attendance, performance, seniority)
- Top 3 cooks get first dibs on shifts for a configurable window
- Dropped shifts go to a pool, notified to sharpest first
- Incentives (extra pay, extensible to PTO) attract cooks to harder shifts

---

## 2. Tech Stack

### Main Application
| Layer | Technology | Rationale |
|-------|------------|-----------|
| Frontend | React 19 + Vite + TypeScript | Already scaffolded, modern stack |
| Backend | Express + Node.js | Already scaffolded |
| Database | PostgreSQL + Prisma | Relational, type-safe ORM with migrations |
| Auth | JWT (access + refresh tokens) | Standard, stateless |
| API Style | REST | Familiar, sufficient for demo |

### Notification Microservice
| Layer | Technology | Rationale |
|-------|------------|-----------|
| Language | Go | User requirement |
| Email | Sender | Free email service |
| Communication | HTTP callbacks | Simple for demo |

### Infrastructure
| Service | Purpose |
|---------|---------|
| Fly.io | App deployment |
| Neon | PostgreSQL database (serverless) |
| Sender | Email notifications |

---

## 3. User Stories

### As an Admin (Chef)
| # | Story | Acceptance Criteria |
|---|-------|---------------------|
| ADMIN-01 | I can create cook accounts with email/password | Cook receives login credentials, can change password |
| ADMIN-02 | I can authorize cooks for specific stations | Cook can only pick shifts for authorized stations |
| ADMIN-03 | I can create weekly schedules with shifts | Shift includes day, start/end time, station, incentive |
| ADMIN-04 | I can release the schedule with one button | Cooks receive notification, can begin picking |
| ADMIN-05 | I can tune scoring weights | Weights affect cook rankings and tier assignment |
| ADMIN-06 | I can set the sharpest window duration | Default 2 hours, configurable |
| ADMIN-07 | I can set incentive amounts per shift | Weekend nights have highest incentive |
| ADMIN-08 | I can rate cook performance (0-100%) | Rating affects cook score |
| ADMIN-09 | I can manage stations | Create, edit, delete stations |

### As a Cook
| # | Story | Acceptance Criteria |
|---|-------|---------------------|
| COOK-01 | I can log in and view my upcoming shifts | Shows date, time, station, incentive |
| COOK-02 | I can view available shifts | Only shows shifts for my authorized stations |
| COOK-03 | I can pick an available shift | If within my tier's window, or first-come-first-served |
| COOK-04 | I can drop a shift | Shift goes to pool, I receive score penalty |
| COOK-05 | I can view my score breakdown | See attendance, performance, seniority components |
| COOK-06 | I receive notifications | Email when schedule released, when shift dropped |

---

## 4. Data Model

### PostgreSQL Schema (Prisma)

#### User
```prisma
model User {
  id              String   @id @default(uuid())
  email           String   @unique
  passwordHash    String
  name            String
  role            String   // "admin" | "cook"
  performanceScore Int     @default(0)  // 0-100
  startDate       DateTime?
  
  stations         CookStation[]
  attendanceLogs   AttendanceLog[]
  assignedShifts   Shift[]          @relation("AssignedCook")
  releasedSchedules Schedule[]       @relation("ReleasedBy")
  notifications    Notification[]
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

#### Station
```prisma
model Station {
  id          String   @id @default(uuid())
  name        String   @unique
  description String?
  
  cooks       CookStation[]
  shifts      Shift[]
  
  createdAt   DateTime @default(now())
}
```

#### CookStation (Authorization - Many-to-Many)
```prisma
model CookStation {
  cookId    String
  stationId String
  cook      User    @relation(fields: [cookId], references: [id], onDelete: Cascade)
  station   Station @relation(fields: [stationId], references: [id], onDelete: Cascade)
  
  @@id([cookId, stationId])
}
```

#### AttendanceLog (Per-Week Attendance)
```prisma
model AttendanceLog {
  id        String   @id @default(uuid())
  cookId    String
  weekStart DateTime
  drops     Int      @default(0)
  tardiness Int      @default(0)
  picks     Int      @default(0)
  
  cook      User     @relation(fields: [cookId], references: [id], onDelete: Cascade)
  
  @@unique([cookId, weekStart])
}
```

#### Schedule (Weekly Container)
```prisma
model Schedule {
  id          String   @id @default(uuid())
  weekStart   DateTime
  weekEnd     DateTime
  isReleased  Boolean  @default(false)
  releasedAt  DateTime?
  releasedById String?
  
  shifts      Shift[]
  releasedBy  User?    @relation("ReleasedBy", fields: [releasedById], references: [id])
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@unique([weekStart])
}
```

#### Shift
```prisma
model Shift {
  id            String   @id @default(uuid())
  scheduleId    String
  day           String   // "Monday", "Tuesday", etc.
  startTime     String   // "18:00"
  endTime       String   // "23:00"
  stationId     String
  
  assignedCookId String?
  isDropped     Boolean  @default(false)
  isAvailable   Boolean  @default(true)
  droppedAt     DateTime?
  
  incentiveType  String  @default("extra_pay")
  incentiveAmount Decimal @default(0)
  
  schedule      Schedule @relation(fields: [scheduleId], references: [id], onDelete: Cascade)
  station       Station  @relation(fields: [stationId], references: [id])
  assignedCook User?    @relation("AssignedCook", fields: [assignedCookId], references: [id])
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

#### Settings (Admin-Only)
```prisma
model Settings {
  id          String  @id @default("default")
  
  // Scoring weights (must sum to 100)
  attendanceWeight  Int    @default(40)
  performanceWeight Int    @default(50)
  seniorityWeight   Int    @default(10)
  
  // Sharpest tier
  sharpestCount       Int  @default(3)
  sharpestWindowHours Int  @default(2)
  
  // Incentive defaults (stored as JSON)
  defaultIncentives Json @default("[]")
  
  updatedAt DateTime @updatedAt
}
```

#### Notification
```prisma
model Notification {
  id        String   @id @default(uuid())
  userId    String
  type      String   // "schedule_released" | "shift_dropped" | "shift_available"
  title     String
  message   String?
  data      Json?
  isRead    Boolean  @default(false)
  emailSent Boolean  @default(false)
  
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  createdAt DateTime @default(now())
}
```

---

## 5. Scoring Algorithm

### Score Calculation
```
totalScore = (
  attendanceScore * weight.attendance +
  performanceScore * weight.performance +
  seniorityScore * weight.seniority
) / 100
```

### Components

**Attendance Score (last 4 weeks)**
```
attendanceScore = max(0, 100 - (drops * 10) - (tardiness * 5) + (picks * 5))
```

**Performance Score**
```
performanceScore = user.performanceScore (0-100, set by admin)
```

**Seniority Score**
```
seniorityScore = min(100, monthsEmployed * 2) // caps at 5 years
```

### Default Weights (Configurable by Admin)
| Factor | Default Weight |
|--------|----------------|
| Attendance | 40% |
| Performance | 50% |
| Seniority | 10% |

### Tier Assignment
- **Sharpest (Top 3)**: First pick window
- **Standard**: After window expires

---

## 6. API Endpoints

### Authentication
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | /api/auth/register | Create user | Admin |
| POST | /api/auth/login | Get tokens | Public |
| POST | /api/auth/refresh | Refresh access token | Authenticated |
| GET | /api/auth/me | Get current user | Authenticated |

### Users (Cooks)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | /api/cooks | List all cooks | Admin |
| GET | /api/cooks/:id | Get cook details | Admin |
| POST | /api/cooks | Create cook | Admin |
| PUT | /api/cooks/:id | Update cook | Admin |
| DELETE | /api/cooks/:id | Delete cook | Admin |
| PUT | /api/cooks/:id/stations | Authorize stations | Admin |
| PUT | /api/cooks/:id/performance | Set performance score | Admin |

### Shifts
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | /api/shifts | List shifts (with filters) | Authenticated |
| GET | /api/shifts/:id | Get shift details | Authenticated |
| POST | /api/shifts | Create shift | Admin |
| PUT | /api/shifts/:id | Update shift | Admin |
| DELETE | /api/shifts/:id | Delete shift | Admin |
| POST | /api/shifts/:id/pick | Pick a shift | Cook |
| POST | /api/shifts/:id/drop | Drop a shift | Cook |

### Schedules
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | /api/schedules | List schedules | Authenticated |
| GET | /api/schedules/:id | Get schedule with shifts | Authenticated |
| POST | /api/schedules | Create schedule | Admin |
| PUT | /api/schedules/:id | Update schedule | Admin |
| POST | /api/schedules/:id/release | Release schedule | Admin |

### Stations
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | /api/stations | List stations | Authenticated |
| POST | /api/stations | Create station | Admin |
| PUT | /api/stations/:id | Update station | Admin |
| DELETE | /api/stations/:id | Delete station | Admin |

### Settings
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | /api/settings | Get settings | Admin |
| PUT | /api/settings | Update settings | Admin |

### Rankings
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | /api/rankings | Get cook rankings | Authenticated |
| GET | /api/rankings/sharpest | Get top 3 cooks | Authenticated |
| GET | /api/cooks/:id/score | Get cook's score breakdown | Authenticated |

### Notifications
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | /api/notifications | List user's notifications | Authenticated |
| PUT | /api/notifications/:id/read | Mark as read | Authenticated |

---

## 7. Notification Microservice (Go)

### Purpose
Handle email notifications asynchronously via HTTP callbacks from main app.

### Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /send | Send email |

### Request Format
```json
{
  "to": "cook@restaurant.com",
  "subject": "New Schedule Released",
  "template": "schedule_released",
  "data": {
    "cookName": "John",
    "weekStart": "2024-01-15",
    "weekEnd": "2024-01-21"
  }
}
```

### Email Templates
| Template | Trigger | Purpose |
|----------|---------|---------|
| `schedule_released` | Schedule released | Notify sharpest first, then rest after window |
| `shift_dropped` | Shift dropped | Notify sharpest first, then others |
| `shift_picked` | Shift picked | Confirmation for cook |

### Communication Flow
```
Main App Event → POST /notification/send → Go Service → Sender API → Email
```

---

## 8. Frontend Structure

### Pages (Simplified with Tabs)

#### Public
| Route | Page | Description |
|-------|------|-------------|
| `/login` | Login | Email/password form |

#### Admin (2 pages)
| Route | Page | Description |
|-------|------|-------------|
| `/admin` | Main | Tabs: Cooks, Schedules, Stations |
| `/admin/settings` | Settings | Scoring weights, window, defaults |

#### Cook (2 pages)
| Route | Page | Description |
|-------|------|-------------|
| `/cook` | Main | Tabs: My Shifts, Available, Score |
| `/notifications` | Notifications | Shared notification page |

### Key Components
| Component | Description |
|-----------|-------------|
| `ShiftCard` | Displays shift: day, time, station, incentive, pick/drop button |
| `CookRow` | Cook in table with name, stations, score badge |
| `ScoreBreakdown` | Visual breakdown: attendance, performance, seniority |
| `TierBadge` | "Sharpest Knife" badge for top 3 |
| `StationBadge` | Shows station name |
| `TabNav` | Tab navigation for main pages |

### Routing Strategy
- React Router v6
- Protected routes by role (admin vs cook)
- Lazy loading for code splitting

---

## 9. Development Cycles

Development follows a TDD approach per module:
```
Write Tests → Implement Backend → Build Frontend
```

### High-Level Cycles

| # | Cycle | Backend Tasks | Frontend Tasks | Stories |
|---|-------|---------------|----------------|---------|
| 1 | **Auth** | Login, register, JWT, middleware | Login page, role redirects | ADMIN-01, COOK-01 |
| 2 | **Stations** | CRUD API | List, create/edit form | ADMIN-09 |
| 3 | **Cooks** | CRUD, station authorization | List, create/edit, performance | ADMIN-02, ADMIN-08 |
| 4 | **Settings** | CRUD, weight validation | Settings form | ADMIN-05, ADMIN-06 |
| 5 | **Schedules** | CRUD, release, shifts | List, create, release button | ADMIN-03, ADMIN-04, ADMIN-07 |
| 6 | **Shift-Cook** | Pick, drop, conflict check, attendance | Available shifts, pick/drop buttons | COOK-02, COOK-03, COOK-04 |
| 7 | **Scoring** | Calculate, rank, tier | Score breakdown, tier badge | COOK-05 |
| 8 | **Notifications + Polish** | Go service, hooks, error handling | Notification list, styling | COOK-06 |

### Cycle Flow

```
Cycle 1: Auth
├── Write auth tests
├── Implement backend (register, login, JWT)
└── Build frontend (login, redirects)

Cycle 2: Stations
├── Write station tests
├── Implement backend (CRUD)
└── Build frontend (list, form)

Cycle 3: Cooks
├── Write cook tests
├── Implement backend (CRUD, stations)
└── Build frontend (list, form, authorization)

... and so on
```

---

## 10. Milestones

### Foundation Tasks (Prerequisites)
- [ ] Set up PostgreSQL + Prisma
- [ ] Set up Neon database
- [ ] Basic UI layout and routing
- [ ] Install test framework

### Milestone 1: Auth Complete
- [ ] Auth backend (tests, register, login, JWT)
- [ ] Auth frontend (login page, redirects)

### Milestone 2: Stations Complete
- [ ] Station backend (tests, CRUD)
- [ ] Station frontend (list, form)

### Milestone 3: Cooks Complete
- [ ] Cook backend (tests, CRUD, station authorization)
- [ ] Cook frontend (list, form, performance)

### Milestone 4: Settings Complete
- [ ] Settings backend (tests, CRUD)
- [ ] Settings frontend (form, validation)

### Milestone 5: Schedules Complete
- [ ] Schedule backend (tests, CRUD, release, shifts)
- [ ] Schedule frontend (list, create, release)

### Milestone 6: Shift-Cook Complete
- [ ] Shift backend (tests, pick, drop, conflict check)
- [ ] Shift frontend (available, pick/drop buttons)

### Milestone 7: Scoring Complete
- [ ] Scoring backend (tests, calculate, rank)
- [ ] Scoring frontend (breakdown, tier badge)

### Milestone 8: Notifications + Polish Complete
- [ ] Go microservice (setup, email, deploy)
- [ ] Notification backend (hooks, list)
- [ ] Notification frontend (list, styling)
- [ ] Error handling, validation
- [ ] Deployment

---

## 11. User Story Mapping

### Story → Cycle → Endpoint → Database Table

| Story | Cycle | Endpoints | Tables |
|-------|-------|-----------|--------|
| **ADMIN-01** Create cook accounts | 1, 3 | `POST /api/auth/register`, `POST /api/cooks` | `User` |
| **ADMIN-02** Authorize stations | 3 | `PUT /api/cooks/:id/stations` | `User`, `Station`, `CookStation` |
| **ADMIN-03** Create schedules with shifts | 5 | `POST /api/schedules`, `POST /api/shifts` | `Schedule`, `Shift`, `Station` |
| **ADMIN-04** Release schedule | 5 | `POST /api/schedules/:id/release` | `Schedule`, `Notification` |
| **ADMIN-05** Tune scoring weights | 4 | `PUT /api/settings` | `Settings` |
| **ADMIN-06** Set sharpest window | 4 | `PUT /api/settings` | `Settings` |
| **ADMIN-07** Set incentives | 5 | `POST /api/shifts`, `PUT /api/shifts/:id` | `Shift` |
| **ADMIN-08** Rate performance | 3 | `PUT /api/cooks/:id/performance` | `User` |
| **ADMIN-09** Manage stations | 2 | `GET/POST/PUT/DELETE /api/stations` | `Station` |
| **COOK-01** View my shifts | 6 | `GET /api/schedules/:id` | `Schedule`, `Shift`, `User` |
| **COOK-02** View available shifts | 6 | `GET /api/shifts` | `Shift`, `Station`, `CookStation` |
| **COOK-03** Pick shift | 6 | `POST /api/shifts/:id/pick` | `Shift`, `AttendanceLog`, `Notification` |
| **COOK-04** Drop shift | 6 | `POST /api/shifts/:id/drop` | `Shift`, `AttendanceLog`, `Notification` |
| **COOK-05** View score breakdown | 7 | `GET /api/cooks/:id/score` | `User`, `AttendanceLog`, `Settings` |
| **COOK-06** Notifications | 8 | `GET /api/notifications` | `Notification` |

### Cycle Summary

| Cycle | Stories | Tables Affected |
|-------|---------|----------------|
| **1** Auth | ADMIN-01, COOK-01 | User |
| **2** Stations | ADMIN-09 | Station |
| **3** Cooks | ADMIN-01, ADMIN-02, ADMIN-08 | User, CookStation |
| **4** Settings | ADMIN-05, ADMIN-06 | Settings |
| **5** Schedules | ADMIN-03, ADMIN-04, ADMIN-07 | Schedule, Shift |
| **6** Shift-Cook | COOK-01, COOK-02, COOK-03, COOK-04 | Shift, AttendanceLog |
| **7** Scoring | COOK-05 | User, AttendanceLog, Settings |
| **8** Notifications + Polish | COOK-06 | Notification |

---

## 12. Decisions Made

| # | Decision | Rationale |
|---|----------|-----------|
| D01 | Single restaurant only | Demo scope |
| D02 | JWT auth | Standard, stateless |
| D03 | Weekly schedules | Simpler for demo |
| D04 | Top 3 as "Sharpest" | Fair, simple |
| D05 | 2-hour default window | Configurable |
| D06 | Percentage-based scoring | Flexible weight tuning |
| D07 | Admin creates cook accounts | Security for demo |
| D08 | Station-based authorization | Adds depth to picking |
| D09 | Drop = penalty, Pickup = reward | Incentivize behavior |
| D10 | Extensible incentives | Extra pay now, PTO later |
| D11 | PostgreSQL + Prisma | Relational, type-safe |
| D12 | Fly.io for deployment | User choice |
| D13 | Neon for database | Serverless Postgres |
| D14 | Go microservice for email | User requirement |
| D15 | Sender for email | Free email service |
| D16 | Prevent overlapping shifts | Avoid scheduling conflicts |
| D17 | 24-hour minimum notice for drops | Allow time for coverage |
| D18 | Skip shift templates | Simplify demo |
| D19 | Keep all schedule history | No data loss |
| D20 | Skip PTO/leave tracking | Demo scope |

---

## 13. Constraints

| Constraint | Value |
|------------|-------|
| Minimum notice for drops | 24 hours before shift |
| Shift conflicts | Prevented (no overlapping shifts) |
| Schedule history | Keep all |
| Templates | Skipped for demo |
| PTO/Leave tracking | Skipped for demo |

---

*Last updated: 2026-04-06*

---

## Kanban Board Task IDs

For tracking in a Kanban tool, use these task prefixes:

| Prefix | Description | Tasks |
|--------|-------------|-------|
| `SETUP-` | Database and project setup | SETUP-01 to SETUP-04 |
| `AUTH-` | Authentication cycle | AUTH-01 to AUTH-03 |
| `STAT-` | Stations cycle | STAT-01 to STAT-03 |
| `COOK-` | Cooks cycle | COOK-01 to COOK-03 |
| `SETT-` | Settings cycle | SETT-01 to SETT-03 |
| `SCHED-` | Schedules cycle | SCHED-01 to SCHED-03 |
| `SHIFT-` | Shift-Cook cycle | SHIFT-01 to SHIFT-03 |
| `SCORE-` | Scoring cycle | SCORE-01 to SCORE-02 |
| `NOTIF-` | Notifications cycle | NOTIF-01 to NOTIF-03 |
| `POLISH-` | Polish cycle | POLISH-01 to POLISH-03 |
