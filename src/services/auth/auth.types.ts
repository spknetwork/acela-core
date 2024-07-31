import { z } from 'zod';

export const network = ['did', 'hive', 'email'] as const;
export type Network = (typeof network)[number];

export const accountTypes = ['singleton', 'lite'] as const;
export type AccountType = (typeof accountTypes)[number];

const userSchema = z.object({
  sub: z.string().optional(),
  network: z.enum(network),
  type: z.enum(accountTypes).optional(),
  user_id: z.string(),
});

export const interceptedRequestSchema = z.object({
  user: userSchema,
});

export type User = z.infer<typeof userSchema>;

export type UserRequest = z.infer<typeof interceptedRequestSchema>;
