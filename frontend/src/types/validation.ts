/**
 * Zod validation schemas
 */

import { z } from 'zod'

export const projectFormSchema = z.object({
  // Basic Information
  project_title: z
    .string()
    .min(1, 'Project title is required')
    .max(500, 'Project title must be less than 500 characters'),
  location: z.string().optional(),
  fund_year: z
    .number()
    .int()
    .min(2010, 'Fund year must be 2010 or later')
    .max(2050, 'Fund year must be 2050 or earlier'),

  // Financial Details
  fund_source: z.string().optional(),
  mode_of_implementation: z.string().optional(),
  project_cost: z
    .number()
    .nonnegative('Project cost must be non-negative'),
  project_scale: z.string().optional(),

  // DEO Assignment (optional, will be set from user's DEO if deo_user)
  deo_id: z.number().int().positive().optional(),

  // Status
  status: z.enum([
    'planning',
    'ongoing',
    'completed',
    'suspended',
    'cancelled',
    'deleted',
  ]).optional(),
})

export type ProjectFormData = z.infer<typeof projectFormSchema>
