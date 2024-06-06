import { z } from 'zod';

const userSchema = z.object({
  sub: z.string(),
  username: z.string(),
  id: z.string().optional(),
});

export const requestSchema = z.object({
  user: userSchema,
});

export type User = z.infer<typeof userSchema>;

export type UserRequest = z.infer<typeof requestSchema>;

export type Upload = {
  authorization: string;
  Storage: { Path: string } | undefined;
  Size: number;
  ID: string;
  MetaData: {
    authorization: string;
    Storage: any;
    Size: number;
    ID: string;
    upload_id: string;
    video_id: string;
  };
};
