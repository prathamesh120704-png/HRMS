import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { requireEnv } from '@/lib/env';

/**
 * Database client that acts AS THE SIGNED-IN USER: the Clerk session token is sent as the JWT, so row-level
 * security evaluates for that user. The anon key is server-only; the service-role key is never used here.
 */
export function userClient(getToken: () => Promise<string | null>): SupabaseClient {
  return createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_ANON_KEY'), {
    accessToken: getToken,
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
