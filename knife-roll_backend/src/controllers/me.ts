import express, { Response, Request } from 'express'
import { z } from 'zod'

const _shiftIdSchema = z.object({
    id: z.coerce.number().int().positive(),
})

export const meRouter = express.Router()

// US-18: View my profile
meRouter.get('/', async (req: Request, res: Response) => {
    // TODO: Implement view profile (US-18)
    // - Requires authenticated user (JWT middleware)
    // - Find user by authenticated user's ID
    // - Return user object without password
    res.status(501).json({ error: 'Not implemented' })
})

// US-13: View my shifts
meRouter.get('/shifts', async (req: Request, res: Response) => {
    // TODO: Implement view my shifts (US-13)
    // - Requires authenticated user (JWT middleware)
    // - Default behavior: return user's assigned shifts + available shifts + pending shifts for user
    // - Optional query params: mine, status, station, from, to
    // - Return schedules with nested shifts
    res.status(501).json({ error: 'Not implemented' })
})

// US-14: Pick up a shift
meRouter.post('/shifts/:id/pickup', async (req: Request, res: Response) => {
    // TODO: Implement shift pickup (US-14)
    // - Requires authenticated user (JWT middleware)
    // - Validate shift ID
    // - Shift must exist, return 404 if not found
    // - Shift must have status 'available', return 409 if not
    // - Overtime logic:
    //   - If (current assigned hours + new shift hours) <= 40 → status = 'assigned'
    //   - If (current assigned hours + new shift hours) > 40 → status = 'pending', pendingType = 'pickup'
    // - Return 200 with updated shift
    res.status(501).json({ error: 'Not implemented' })
})

// US-15: Drop a shift
meRouter.post('/shifts/:id/drop', async (req: Request, res: Response) => {
    // TODO: Implement shift drop (US-15)
    // - Requires authenticated user (JWT middleware)
    // - Validate shift ID
    // - Shift must exist, return 404 if not found
    // - Shift must have status 'assigned', return 409 if not
    // - Shift must belong to authenticated user, return 403 if not
    // - Set status = 'pending', pendingType = 'drop' (userId stays)
    // - Return 200 with updated shift
    res.status(501).json({ error: 'Not implemented' })
})