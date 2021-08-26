import { SupabaseClient } from '@supabase/supabase-js';
import { Request, Response } from 'express';
import { Session } from 'express-session';
import { Redis } from 'ioredis';

export type MyContext = {
  req: Request & { session: Session & { userId: string } };
  res: Response;
  redis: Redis;
  supabase: SupabaseClient;
};
