import { z } from 'zod';

export const network = ['did', 'hive', 'email'] as const;
export type Network = (typeof network)[number];

export const accountTypes = ['singleton', 'lite'] as const;
export type AccountType = (typeof accountTypes)[number];

export const ProofPayloadSchema = z.object({
  account: z.string(),
  ts: z.number(),
});

const userSchema = z.object({
  sub: z.string(),
  username: z.string(),
  network: z.enum(network),
  type: z.enum(accountTypes).optional(),
  id: z.string().optional(),
});

export const interceptedRequestSchema = z.object({
  user: userSchema,
});

export type User = z.infer<typeof userSchema>;

export type UserRequest = z.infer<typeof interceptedRequestSchema>;
