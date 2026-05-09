# Backend User Stories

Admin-first, then regular user stories. Each story maps to one or more API endpoints.

---

## Auth Middleware

Token validation middleware is part of US-5 implementation. Every endpoint falls into one of three auth categories:

### Public (no auth required)

| Method | Path | Story |
|--------|------|-------|
| POST | `/api/login` | US-5 |
| GET | `/api/stations` | US-3 |

### Authenticated (any logged-in user)

| Method | Path | Story | Notes |
|--------|------|-------|-------|
| GET | `/api/me` | US-18 | Own profile only |
| POST | `/api/users/:id/password` | US-6 | Must be own user ID |
| GET | `/api/me/shifts` | US-13 | Own shifts + available |
| POST | `/api/me/shifts/:id/pickup` | US-14 | Own actions |
| POST | `/api/me/shifts/:id/drop` | US-15 | Own shifts only |

### Admin required

| Method | Path | Story |
|--------|------|-------|
| POST | `/api/schedules` | US-1 |
| PATCH | `/api/schedules/:id` | US-16 |
| DELETE | `/api/schedules/:id` | US-11 |
| GET | `/api/schedules` | US-9 |
| GET | `/api/schedules/:id` | US-9 |
| POST | `/api/schedules/:scheduleId/shifts` | US-2 |
| POST | `/api/stations` | US-3 |
| PATCH | `/api/stations/:id` | US-17 |
| DELETE | `/api/stations/:id` | US-3 |
| POST | `/api/users` | US-4 |
| PATCH | `/api/users/:id` | US-12 |
| GET | `/api/users` | US-10 |
| GET | `/api/users/:id` | US-10 |
| PATCH | `/api/shifts/:id` | US-7 |
| DELETE | `/api/shifts/:id` | US-11 |

---

## US-1: Create a schedule

**As an** admin/chef, **I want to** create a schedule from date A to date B **so that** I can define a work period for my kitchen staff.

### Endpoints

| Method | Path | Description | Request Body | Response |
|--------|------|-------------|--------------|----------|
| POST | `/api/schedules` | Create a new schedule | `{ startDate, endDate, createdBy }` | `201` — created schedule |

### Request Body

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `startDate` | `z.string().date()` | Yes | ISO 8601 date format (`YYYY-MM-DD`) |
| `endDate` | `z.string().date()` | Yes | Must be >= `startDate` |
| `createdBy` | `z.number().int()` | Yes | FK to User (temporary — until auth is added) |

### Notes

- `createdBy` sent in body is temporary — will come from auth session once implemented
- Schedule dates use `date` format (`YYYY-MM-DD`), not `datetime` — schedules define calendar windows, not precise times
- Prisma converts `date` strings to `DateTime` objects for PostgreSQL storage

---

## US-2: Add shifts to a schedule

**As an** admin/chef, **I want to** add shifts to a created schedule **so that** I can define work periods for specific stations within the schedule window.

### Endpoints

| Method | Path | Description | Request Body | Response |
|--------|------|-------------|--------------|----------|
| POST | `/api/schedules/:scheduleId/shifts` | Create a shift under a schedule | see below | `201` — created shift |

### Request Body

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `startTime` | `z.string().datetime()` | Yes | ISO 8601 datetime |
| `endTime` | `z.string().datetime()` | Yes | Must be >= `startTime` |
| `stationName` | `z.string().min(1)` | Yes | FK to Station (station must exist) |
| `incentive` | `z.number().positive().multipleOf(0.01).nullable().optional()` | No | Additional pay on top of employee's base rate |
| `userId` | `z.number().int()` | No | Optional assignment at creation, defaults to null |
| `status` | `z.enum(['available', 'assigned', 'pending']).default('available')` | No | Defaults to `available` |

### Validation

- `startTime` must be < `endTime`
- `scheduleId` must reference an existing schedule (Prisma FK constraint catches this as `P2003`)
- `stationName` must reference an existing station

### Notes

- Route is nested under schedules — shifts belong to a schedule contextually
- `userId` is optional at creation — shifts can be left open for later assignment/pickup
- Station creation is covered in US-3
- `scheduleId` comes from the URL path, not the request body
- `incentive` added by US-8 amendment
- `status` replaces the original `available` boolean field (amended by US-14)

---

## US-3: Manage stations

**As an** admin/chef, **I want to** create, list, and delete stations **so that** I can assign stations to shifts.

### Endpoints

| Method | Path | Description | Request Body | Response |
|--------|------|-------------|--------------|----------|
| POST | `/api/stations` | Create a station | `{ name: string }` | `201` — created station |
| GET | `/api/stations` | List all stations | — | `200` — station array (with shifts) |
| PATCH | `/api/stations/:id` | Update a station | `{ name: string }` | `200` — updated station |
| DELETE | `/api/stations/:id` | Delete a station | — | `204` — no content |

### Validation

- `name` — required, `z.string().min(1)`, must be unique (Prisma `P2002` catches duplicates)
- Delete by `id` for consistency with other resources, even though `name` functions as a natural identifier

### Notes

- `name` is the only field on Station — intentionally minimal
- GET includes related shifts in the response (Prisma `include: { shifts: true }`)
- Deleting a station with existing shifts will fail (Prisma `onDelete: Restrict` on Shift→Station relation) — client should reassign shifts first
- `GET /api/stations` is public — no auth required

---

## US-4: Create employees in the system

**As an** admin/chef, **I want to** create new employees in the system with a default password **so that** they can be assigned to shifts and eventually log in.

### Endpoints

| Method | Path | Description | Request Body | Response |
|--------|------|-------------|--------------|----------|
| POST | `/api/users` | Create a user/employee | see below | `201` — created user |

### Request Body

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `email` | `z.string().email()` | Yes | Must be unique |
| `name` | `z.string()` | No | Optional display name |
| `admin` | `z.boolean()` | No | Defaults to `false` |
| `basePayRate` | `z.number().positive().multipleOf(0.01).optional()` | No | Employee's standard hourly pay rate |

### Validation

- `email` must be unique (Prisma `P2002` catches duplicates)
- Password is set to a fixed default and hashed before storage — not sent by client
- `mustChangePassword` will be set to `true` on creation

### Database Changes Required

New columns on `User`:
- `passwordHash` — `String`, stores bcrypt hash of the default password
- `mustChangePassword` — `Boolean`, defaults to `true`

A new Prisma migration will be needed to add these fields.

### Notes

- Default password is fixed (configurable server-side) — hashed via bcrypt before storage, never returned in responses
- `mustChangePassword` flag set to `true` on creation — forces password reset on first login (US-5)
- `passwordHash` and `mustChangePassword` are never included in API responses
- `admin` is optional, defaults to `false` — same endpoint can create admin users if needed
- Login/auth endpoints are in US-5
- `basePayRate` added by US-8 amendment

---

## US-5: Log in to the system

**As an** admin/chef, **I want to** log in to the system **so that** I can access protected features.

### Endpoints

| Method | Path | Description | Request Body | Response |
|--------|------|-------------|--------------|----------|
| POST | `/api/login` | Authenticate and receive a JWT | `{ email, password }` | `200` — token + user info |

### Request Body

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `email` | `z.string().email()` | Yes | User's email |
| `password` | `z.string()` | Yes | Plaintext password |

### Response

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "mustChangePassword": true,
  "user": {
    "id": 1,
    "email": "chef@kitchen.com",
    "name": "Head Chef",
    "admin": true
  }
}
```

### Validation

- Email must match an existing user
- Password must match the stored `passwordHash` (bcrypt compare)
- Invalid credentials return `401` with generic error message ("invalid email or password") — no hint about which field is wrong

### Notes

- JWT tokens — stateless, sent as `Authorization: Bearer <token>` header on subsequent requests
- Auth middleware must verify token signature, extract user, attach to `req`, and handle expired tokens
- `mustChangePassword` flag — if `true`, login still succeeds (200 response) but frontend should force a password change before allowing normal navigation
- Token expiration will need to be decided when implementing; common default is 1 hour with a refresh mechanism
- `passwordHash` is never included in responses
- Password change endpoint is US-6
- New dependency needed: `jsonwebtoken` (or `jose`) for signing/verifying JWTs, `bcrypt` for password hashing
- See Auth Middleware section above for endpoint-to-auth mapping

---

## US-6: Change password

**As an** admin/chef, **I want to** change my password **so that** I can set my own password instead of the default.

### Endpoints

| Method | Path | Description | Request Body | Response |
|--------|------|-------------|--------------|----------|
| POST | `/api/users/:id/password` | Change user's password | `{ currentPassword, newPassword }` | `204` — no content |

### Request Body

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `currentPassword` | `z.string()` | Yes | Must match stored `passwordHash` |
| `newPassword` | `z.string().min(8)` | Yes | Minimum 8 characters |

### Validation

- `currentPassword` must match the stored bcrypt hash — returns `401` if incorrect
- `newPassword` must be at least 8 characters
- Requires authenticated user (JWT middleware) — only the user themselves can change their password
- `:id` in the URL must match the authenticated user's ID — a user can only change their own password

### Notes

- Single endpoint for both voluntary and forced password changes
- `mustChangePassword` is automatically set to `false` after a successful change — clears the flag from US-4
- Requires token validation middleware (from US-5) to identify the authenticated user

---

## US-7: Modify a shift (admin)

**As an** admin/chef, **I want to** assign, reassign, or unassign a cook to a shift **so that** I can manage who works each station.

### Endpoints

| Method | Path | Description | Request Body | Response |
|--------|------|-------------|--------------|----------|
| PATCH | `/api/shifts/:id` | Update a shift | see below | `200` — updated shift |

### Request Body

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `userId` | `z.number().int().nullable()` | Conditional* | `null` to unassign, a user ID to assign |
| `status` | `z.enum(['available', 'assigned', 'pending'])` | Conditional* | Override shift status directly |
| `incentive` | `z.number().positive().multipleOf(0.01).nullable()` | Conditional* | Additional pay on top of employee's base rate |

*At least one of `userId`, `status`, or `incentive` must be provided — reject empty body with `400`.

### Auto-behavior

- When `userId` is set to a value + `status` not specified → `status` is automatically set to `assigned`
- When `userId` is set to `null` + `status` not specified → `status` is automatically set to `available`
- Explicit `status` in the body overrides the auto-behavior

### Validation

- Requires admin privileges (JWT middleware + `admin: true` check)
- `shiftId` must exist — returns `404` if not found
- If `userId` is provided (not null), the user must exist — Prisma FK constraint
- At least one of `userId`, `status`, or `incentive` must be provided — reject empty body with `400`

### Notes

- This is the **admin action** — requires admin privileges
- Distinct from the employee "pickup shift" flow (US-14) and "drop shift" flow (US-15)
- The auto-behavior on `status` reduces manual effort: assigning a cook always makes the shift assigned, unassigning opens it back up
- Explicit `status` override exists for edge cases (e.g., admin unassigns someone but wants the shift to stay unavailable while finding a replacement)
- `incentive` added by US-8 amendment
- `status` replaces the original `available` boolean field (amended by US-14)

---

## US-8: Assign incentive pay to shifts and base pay rate to employees

**As an** admin/chef, **I want to** assign pay rates **so that** each shift's total compensation is the employee's base pay rate plus any shift incentive.

### Endpoints

| Method | Path | Description | Request Body | Response |
|--------|------|-------------|--------------|----------|
| PATCH | `/api/shifts/:id` | Update shift incentive | `{ incentive?: number }` | `200` — updated shift |

### Validation

- `incentive` — `z.number().positive().multipleOf(0.01)`. Nullable (can be set to `null` to remove)
- At least one of `userId`, `status`, or `incentive` must be provided (same rule as US-7)
- Requires admin privileges

### Database Changes Required

- **Shift** table: add `incentive` column — `Decimal?` (nullable, no default)
- **User** table: add `basePayRate` column — `Decimal?` (nullable, no default)

### Amendments to Previous Stories

**US-2 (Create shift):** Add optional `incentive` field to request body and `CreateShiftSchema`

| `incentive` | `z.number().positive().multipleOf(0.01).nullable().optional()` | No | Additional pay on top of employee's base rate |

**US-4 (Create employee):** Add optional `basePayRate` field to request body and `CreateUserSchema`

| `basePayRate` | `z.number().positive().multipleOf(0.01).optional()` | No | Employee's standard hourly pay rate |

**US-7 (Modify shift):** Add `incentive` as an updatable field alongside `userId` and `status`

### Notes

- Total shift compensation = `user.basePayRate + shift.incentive`
- Both fields are nullable — new employees may not have a base rate yet, shifts may not have an incentive
- `basePayRate` is a property of the person, `incentive` is a property of the shift — they combine at calculation time

---

## US-9: View schedules

**As an** admin/chef, **I want to** view schedules and their shifts **so that** I can see the full picture of work periods.

### Endpoints

| Method | Path | Description | Query Params | Response |
|--------|------|-------------|--------------|----------|
| GET | `/api/schedules` | List schedules (with shifts) | Optional: see below | `200` — schedule array (nested) |
| GET | `/api/schedules/:id` | Get a single schedule (with shifts) | — | `200` — single schedule (nested) |

### Query Parameters (GET /api/schedules)

| Param | Type | Example | Filters |
|-------|------|---------|---------|
| `from` | `YYYY-MM-DD` | `?from=2026-05-01` | Schedules where `startDate >= from` |
| `to` | `YYYY-MM-DD` | `?to=2026-06-01` | Schedules where `endDate <= to` |
| `station` | `string` | `?station=grill` | Shifts by station name |
| `status` | `string` | `?status=available` | Shifts by status (`available`, `assigned`, `pending`) |
| `userId` | `integer` | `?userId=5` | Shifts by assigned cook |

All params are optional and composable. Schedules with zero matching shifts still appear with an empty `shifts` array.

### Response Structure

```json
[
  {
    "id": 1,
    "startDate": "2026-05-05",
    "endDate": "2026-05-11",
    "createdBy": 3,
    "createdAt": "2026-05-01T10:00:00.000Z",
    "shifts": [
      {
        "id": 10,
        "startTime": "2026-05-05T08:00:00.000Z",
        "endTime": "2026-05-05T16:00:00.000Z",
        "stationName": "grill",
        "userId": 5,
        "status": "assigned",
        "incentive": 2.50,
        "pendingType": null,
        "user": { "id": 5, "name": "Carlos", "email": "carlos@kitchen.com" }
      }
    ]
  }
]
```

**Detail (`GET /api/schedules/:id`):** Same structure, single object. Returns `404` if not found.

### Notes

- No separate `GET /api/shifts` endpoint — shifts are always accessed through their parent schedule
- No pagination for now — can be added later if needed
- Requires admin privileges
- `pendingType` is `null` unless `status: pending` — then it's `"pickup"` or `"drop"` (added by US-14)

---

## US-10: View employees

**As an** admin/chef, **I want to** view employees and their assigned shifts **so that** I can see who's in the system and what they're working.

### Endpoints

| Method | Path | Description | Response |
|--------|------|-------------|----------|
| GET | `/api/users` | List all employees (with shifts) | `200` — user array |
| GET | `/api/users/:id` | Get a single employee (with shifts) | `200` — single user |

### Response Structure

```json
{
  "id": 5,
  "email": "carlos@kitchen.com",
  "name": "Carlos",
  "admin": false,
  "basePayRate": 18.00,
  "shifts": [
    {
      "id": 10,
      "startTime": "2026-05-05T08:00:00.000Z",
      "endTime": "2026-05-05T16:00:00.000Z",
      "stationName": "grill",
      "status": "assigned",
      "incentive": 2.50,
      "scheduleId": 1
    }
  ]
}
```

### Notes

- `passwordHash` and `mustChangePassword` are **never** included in any response
- Each user includes their assigned shifts (with schedule reference)
- No filters for now — can be added later
- Requires admin privileges
- `scheduledHours` has been removed from the User model — hours are calculated dynamically from shifts

---

## US-11: Delete schedules and shifts

**As an** admin/chef, **I want to** delete schedules and shifts **so that** I can remove outdated or mistaken entries.

### Endpoints

| Method | Path | Description | Query Params | Response |
|--------|------|-------------|--------------|----------|
| DELETE | `/api/schedules/:id` | Delete a schedule and its shifts | Optional: `confirm` | `204` — no content |
| DELETE | `/api/shifts/:id` | Delete a shift | — | `204` — no content |

### Schedule Deletion — Confirmation Flow

If the schedule has shifts and `confirm` is not provided:
```json
{
  "error": "This schedule has N shifts that will be deleted. Pass ?confirm=true to proceed.",
  "shiftCount": 12
}
```
Response: `409 Conflict`

If `?confirm=true` is passed (or the schedule has no shifts), deletion proceeds and returns `204`.

### Validation

- Schedule `:id` must exist — `404` if not found
- Shift `:id` must exist — `404` if not found
- Both require admin privileges
- Schedule deletion cascades to all related shifts (Prisma `onDelete: Cascade`)

### Notes

- Deleting a schedule is a destructive action — the confirmation step prevents accidental deletion of schedules with shifts
- Deleting a single shift has no cascading dependencies — no confirmation needed
- When a shift is deleted, its station, schedule, and user are unaffected
- No endpoint for deleting employees yet — will be a separate story if needed

---

## US-12: Update employee info

**As an** admin/chef, **I want to** update employee information **so that** I can keep records current.

### Endpoints

| Method | Path | Description | Request Body | Response |
|--------|------|-------------|--------------|----------|
| PATCH | `/api/users/:id` | Update employee info | see below | `200` — updated user |

### Request Body

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `email` | `z.string().email()` | No | Must remain unique |
| `name` | `z.string()` | No | Optional display name |
| `admin` | `z.boolean()` | No | Promote/demote admin status |
| `basePayRate` | `z.number().positive().multipleOf(0.01).nullable()` | No | Can be set to `null` to remove |

At least one field must be provided — reject empty body with `400`.

### Validation

- User `:id` must exist — `404` if not found
- `email` must be unique (Prisma `P2002` catches duplicates) — `409` if taken
- Requires admin privileges

### Notes

- `id`, `createdAt`, `passwordHash`, and `mustChangePassword` are not editable through this endpoint
- `basePayRate` can be explicitly set to `null` to remove a rate
- `passwordHash` and `mustChangePassword` are never included in the response
- Employee self-service updates (name, email only) will be a separate story

---

## US-13: View my schedule (cook)

**As a** cook, **I want to** see my assigned shifts and available shifts **so that** I can plan my work and find shifts to pick up.

### Endpoints

| Method | Path | Description | Query Params | Response |
|--------|------|-------------|--------------|----------|
| GET | `/api/me/shifts` | List shifts relevant to the authenticated cook | Optional: see below | `200` — schedules with shifts (nested) |

### Query Parameters

| Param | Type | Example | Filters |
|-------|------|---------|---------|
| `mine` | `boolean` | `?mine=true` | Only shifts assigned to the authenticated user |
| `status` | `string` | `?status=available` | Filter by shift status (`available`, `assigned`, `pending`) |
| `station` | `string` | `?station=grill` | Shifts by station name |
| `from` | `YYYY-MM-DD` | `?from=2026-05-01` | Shifts in schedules where `startDate >= from` |
| `to` | `YYYY-MM-DD` | `?to=2026-06-01` | Shifts in schedules where `endDate <= to` |

All params are optional and composable.

**Default behavior** (no params): returns the authenticated user's assigned shifts + all available shifts + the user's pending shifts, grouped by schedule.

### Response Structure

Same nested structure as US-9 — schedules containing filtered shifts:

```json
[
  {
    "id": 1,
    "startDate": "2026-05-05",
    "endDate": "2026-05-11",
    "createdBy": 3,
    "createdAt": "2026-05-01T10:00:00.000Z",
    "shifts": [
      {
        "id": 10,
        "startTime": "2026-05-05T08:00:00.000Z",
        "endTime": "2026-05-05T16:00:00.000Z",
        "stationName": "grill",
        "userId": 5,
        "status": "assigned",
        "incentive": 2.50,
        "pendingType": null,
        "user": { "id": 5, "name": "Carlos" }
      }
    ]
  }
]
```

### Notes

- Requires authenticated user (JWT middleware) — no admin privileges needed
- No separate detail endpoint — `/api/me/shifts` covers it
- Schedules with zero matching shifts still appear with empty `shifts` array

---

## US-14: Pick up a shift (cook)

**As a** cook, **I want to** pick up an available shift **so that** I can claim work hours, but if it would put me over 40 hours in the schedule, it requires admin approval.

### Endpoints

| Method | Path | Description | Request Body | Response |
|--------|------|-------------|--------------|----------|
| POST | `/api/me/shifts/:id/pickup` | Pick up an available shift | — | `200` — updated shift |

### Overtime Logic

- Calculate the cook's **total assigned hours** in the same schedule as the shift (sum of hours from all shifts where `userId = authenticated user` and `shift.status = assigned`)
- If `(current hours + new shift hours) <= 40` → shift is assigned immediately, `status: assigned`, `userId` set to the cook
- If `(current hours + new shift hours) > 40` → shift is set to `status: pending`, `userId` set to the cook, `pendingType: "pickup"`, awaiting admin approval

### Validation

- Shift must exist — `404` if not found
- Shift must have `status: available` — `409` if already `assigned` or `pending`
- Requires authenticated user (JWT middleware) — no admin privileges needed
- A schedule is assumed to cover a single week (Monday–Sunday inclusive)
- Overtime threshold is hardcoded at **40 hours per schedule**

### Notes

- Shift hours are calculated as `endTime - startTime`
- Only `assigned` shifts count toward the 40-hour total (not `pending`)
- A cook cannot pick up a shift that is already `assigned` or `pending`

### Database Changes Required

**Replace** the `available` boolean on `Shift` with a `status` enum and add `pendingType`:

```prisma
enum ShiftStatus {
  available
  assigned
  pending
}
```

- `available` — open for pickup, no user assigned
- `assigned` — taken by a cook (`userId` is set)
- `pending` — request awaiting admin approval (could be pickup or drop)

Add `pendingType` column on `Shift`:
- `pendingType` — `String?` (nullable), values: `"pickup"` or `"drop"`
- Only set when `status: pending`, `null` otherwise

### Amendments to Previous Stories

**US-2 (Create shift):** Replace `available: z.boolean().default(true)` with `status: z.enum(['available', 'assigned', 'pending']).default('available')`. Default is `available`.

**US-7 (Modify shift — admin):** Replace `available` field with `status`. Admin can set `status` to any value including approving pending shifts. When admin sets `userId`, auto-behavior becomes:
- `userId` set + `status` not specified → `status` auto-set to `assigned`
- `userId` set to `null` + `status` not specified → `status` auto-set to `available`
- Explicit `status` overrides auto-behavior

**US-9 (View schedules):** Replace `available` boolean filter with `status` enum filter (`?status=available`, `?status=assigned`, `?status=pending`). Response includes `status` and `pendingType` fields instead of `available`.

**US-10 (View employees):** Replace `available` boolean in shift response with `status` and `pendingType` fields.

**US-13 (View my schedule — cook):** Replace `available` query param with `status`. Default behavior returns shifts with `status: assigned` (matching user) + `status: available` + `status: pending` where `userId` matches the authenticated user.

---

## US-15: Drop a shift (cook)

**As a** cook, **I want to** drop a shift I don't want to work **so that** I can be freed from it, pending admin approval.

### Endpoints

| Method | Path | Description | Request Body | Response |
|--------|------|-------------|--------------|----------|
| POST | `/api/me/shifts/:id/drop` | Request to drop an assigned shift | — | `200` — updated shift |

### Behavior

- Shift `status` changes from `assigned` to `pending`
- `userId` stays on the shift so the admin can see who requested the drop
- `pendingType` is set to `"drop"`
- The shift is not fully dropped until an admin approves it

### Validation

- Shift must exist — `404` if not found
- Shift `status` must be `assigned` — `409` if already `available` or `pending`
- Shift must belong to the authenticated user (`userId` must match) — `403` if not
- Requires authenticated user (JWT middleware) — no admin privileges needed

### Notes

- Uses the same `pending` status as overtime pickup requests — admin sees both types in the same queue
- `pendingType` distinguishes pending pickups (`"pickup"`) from pending drops (`"drop"`) in the response
- A cook cannot cancel their own pending pickup request via this endpoint — only admins can change `pending` shifts
- When an admin approves the drop: shift `status` becomes `available`, `userId` becomes `null`, `pendingType` becomes `null`

---

## US-16: Update a schedule

**As an** admin/chef, **I want to** update a schedule's dates **so that** I can correct mistakes or adjust timeframes.

### Endpoints

| Method | Path | Description | Request Body | Response |
|--------|------|-------------|--------------|----------|
| PATCH | `/api/schedules/:id` | Update a schedule | see below | `200` — updated schedule |

### Request Body

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `startDate` | `z.string().date()` | No | ISO 8601 date format (`YYYY-MM-DD`) |
| `endDate` | `z.string().date()` | No | Must be >= `startDate` if both provided |

At least one field must be provided — reject empty body with `400`.

### Validation

- Schedule `:id` must exist — `404` if not found
- If both `startDate` and `endDate` are provided, `endDate` must be >= `startDate`
- If only `endDate` is provided, it must be >= the existing `startDate`
- If only `startDate` is provided, it must be <= the existing `endDate`
- Requires admin privileges

### Notes

- Keeps the same validation rules as US-1 (creation) for date range
- Shifts within the schedule are unaffected — their times don't need to match the schedule window

---

## US-17: Update a station

**As an** admin/chef, **I want to** rename a station **so that** I can keep station names current.

### Endpoints

| Method | Path | Description | Request Body | Response |
|--------|------|-------------|--------------|----------|
| PATCH | `/api/stations/:id` | Update a station | `{ name: string }` | `200` — updated station |

### Request Body

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `name` | `z.string().min(1)` | Yes | New name for the station |

### Validation

- Station `:id` must exist — `404` if not found
- `name` must be unique (Prisma `P2002` catches duplicates) — `409` if taken
- Requires admin privileges

### Notes

- Renaming a station updates the `name` field on Station — existing Shift records reference station by `stationName` FK, so Prisma will handle the cascade update
- `name` is the only editable field on Station

---

## US-18: View my profile (Nice to have)

**As a** cook, **I want to** see my profile information **so that** I can verify my details.

### Endpoints

| Method | Path | Description | Response |
|--------|------|-------------|----------|
| GET | `/api/me` | Get authenticated user's profile | `200` — user object |

### Response Structure

```json
{
  "id": 5,
  "email": "carlos@kitchen.com",
  "name": "Carlos",
  "admin": false,
  "basePayRate": 18.00
}
```

### Notes

- Requires authenticated user (JWT middleware) — no admin privileges needed
- Only returns the authenticated user's own profile — no ability to view other users
- `passwordHash` and `mustChangePassword` are **never** included in the response
- Does not include shifts — use `GET /api/me/shifts` (US-13) for schedule data

---

## US-19: Logout / Refresh (Nice to have)

**As a** user, **I want to** log out or refresh my token **so that** my session is secure.

### Endpoints

| Method | Path | Description | Request Body | Response |
|--------|------|-------------|--------------|----------|
| POST | `/api/logout` | Invalidate current token | — | `204` — no content |
| POST | `/api/refresh` | Get a new token | `{ refreshToken }` | `200` — new token pair |

### Notes

- **Logout:** Depends on token strategy. If using a blocklist, store invalidated tokens until expiry. If purely stateless JWT, logout is client-side (discard token) and this endpoint is a no-op.
- **Refresh:** Requires a separate refresh token (longer expiry). Issues a new access token + refresh token pair. The old refresh token is invalidated.
- Both endpoints are nice-to-have — v1 can rely on short-lived JWTs with client-side logout (discard token).

---

## Implement Later

Endpoints and features to build in future iterations:

- **`PATCH /api/shifts/:id/approve`** — Admin approves both pending pickups and pending drops. For pickups: `status → assigned`, `pendingType → null`. For drops: `status → available`, `userId → null`, `pendingType → null`.
- **Auto-recalculation** — When a drop is approved, check if hours freed up allow picking up other pending shifts for the same cook.
- **Cancel pending request** — Allow a cook to cancel their own pending pickup request.
- **Delete employee** — `DELETE /api/users/:id` with appropriate safeguards (unassign from shifts, etc.)

---

## Database Changes Summary

All schema changes required across user stories:

### New columns on `User`

| Column | Type | Default | Story |
|--------|------|---------|-------|
| `passwordHash` | `String` | — | US-4 |
| `mustChangePassword` | `Boolean` | `true` | US-4 |
| `basePayRate` | `Decimal?` | `null` | US-8 |

### Remove from `User`

| Column | Story |
|---------|-------|
| `scheduledHours` | Removed — hours calculated dynamically from shifts |

### New columns on `Shift`

| Column | Type | Default | Story |
|--------|------|---------|-------|
| `incentive` | `Decimal?` | `null` | US-8 |
| `pendingType` | `String?` | `null` | US-14 |

### Replace on `Shift`

| Old | New | Story |
|-----|-----|-------|
| `available: Boolean` | `status: ShiftStatus` (enum: `available`, `assigned`, `pending`) | US-14 |

### New `ShiftStatus` enum

```prisma
enum ShiftStatus {
  available
  assigned
  pending
}
```

### New dependencies

| Package | Purpose | Story |
|---------|---------|-------|
| `jsonwebtoken` or `jose` | JWT signing/verification | US-5 |
| `bcrypt` | Password hashing | US-4 |

---

## Endpoint Summary

| # | Story | Endpoints |
|---|-------|-----------|
| US-1 | Create a schedule | `POST /api/schedules` |
| US-2 | Add shifts to a schedule | `POST /api/schedules/:scheduleId/shifts` |
| US-3 | Manage stations | `POST /api/stations`, `GET /api/stations`, `PATCH /api/stations/:id`, `DELETE /api/stations/:id` |
| US-4 | Create employees | `POST /api/users` |
| US-5 | Log in | `POST /api/login` |
| US-6 | Change password | `POST /api/users/:id/password` |
| US-7 | Modify a shift (admin) | `PATCH /api/shifts/:id` |
| US-8 | Assign pay rates | (amends US-2, US-4, US-7) |
| US-9 | View schedules | `GET /api/schedules`, `GET /api/schedules/:id` |
| US-10 | View employees | `GET /api/users`, `GET /api/users/:id` |
| US-11 | Delete schedules & shifts | `DELETE /api/schedules/:id`, `DELETE /api/shifts/:id` |
| US-12 | Update employee info | `PATCH /api/users/:id` |
| US-13 | View my schedule (cook) | `GET /api/me/shifts` |
| US-14 | Pick up a shift (cook) | `POST /api/me/shifts/:id/pickup` |
| US-15 | Drop a shift (cook) | `POST /api/me/shifts/:id/drop` |
| US-16 | Update a schedule | `PATCH /api/schedules/:id` |
| US-17 | Update a station | `PATCH /api/stations/:id` |
| US-18 | View my profile (nice to have) | `GET /api/me` |
| US-19 | Logout / Refresh (nice to have) | `POST /api/logout`, `POST /api/refresh` |