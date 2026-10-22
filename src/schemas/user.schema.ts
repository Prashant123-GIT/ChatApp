import { z } from 'zod';

export const createUserSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address'),
});
