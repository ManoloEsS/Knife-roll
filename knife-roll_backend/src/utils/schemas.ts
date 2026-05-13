import { z } from 'zod'

// TODO: Refine and complete all schemas - these are minimal implementations for US-1

export const CreateScheduleSchema = z.object({
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    createdBy: z.number().int(),
}).refine(data => data.endDate >= data.startDate, {
    message: 'endDate must be greater than or equal to startDate',
    path: ['endDate'],
})


export const CreateUserSchema = z.object({
    email: z.email(),
    name: z.string().optional(),
    admin: z.boolean().default(false),
    basePayRate: z.number().positive().multipleOf(0.01).optional(),
}).strict()


export const CreateShiftSchema = z.object({
    shiftTime: z.enum(['breakfast', 'lunch', 'dinner']).default('breakfast'),
    date: z.iso.date(),
    stationName: z.string().min(1),
    incentive: z.number().nonnegative().multipleOf(0.01).nullable().optional(),
    userId: z.number().int().optional(),
    status: z.enum(['available', 'assigned', 'pending']).default('available'),
})

export const CreateStationSchema = z.object({
    name: z.string().min(1),
}).strict()

// PickUpShiftSchema (US-14)
// (no body needed - empty)

// DropShiftSchema (US-15)
// (no body needed - empty)

// ChangePasswordSchema
// - currentPassword: z.string()
// - newPassword: z.string().min(8)
// - strict()

// LoginSchema
// - email: z.string().email()
// - password: z.string()
// - strict()

// UpdateScheduleSchema
// - startDate: z.string().date().optional()
// - endDate: z.string().date().optional()
// - refinement: if both provided, endDate >= startDate
// - strict()

// UpdateStationSchema
// - name: z.string().min(1)
// - strict()

// UpdateUserSchema
// - email: z.string().email().optional()
// - name: z.string().optional()
// - admin: z.boolean().optional()
// - basePayRate: z.number().positive().multipleOf(0.01).nullable().optional()
// - strict()

// UpdateShiftSchema
// - userId: z.number().int().nullable().optional()
// - status: z.enum(['available', 'assigned', 'pending']).optional()
// - incentive: z.number().positive().multipleOf(0.01).nullable().optional()
// - strict()
// - at least one field required
