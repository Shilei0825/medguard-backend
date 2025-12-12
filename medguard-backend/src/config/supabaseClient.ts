import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

/**
 * Supabase client instance for database operations.
 * Uses the anon key by default - suitable for authenticated operations.
 * 
 * For admin operations that bypass RLS, use the service role client
 * (requires SUPABASE_SERVICE_ROLE_KEY to be set).
 */
export const supabase: SupabaseClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: false, // Server-side, no session persistence needed
    },
  }
);

/**
 * Service role client for admin operations that bypass Row Level Security.
 * Only available if SUPABASE_SERVICE_ROLE_KEY is configured.
 */
export const supabaseAdmin: SupabaseClient | null = env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

/**
 * Helper to get the appropriate client based on operation type.
 * Falls back to regular client if service role is not available.
 */
export function getClient(useServiceRole: boolean = false): SupabaseClient {
  if (useServiceRole && supabaseAdmin) {
    return supabaseAdmin;
  }
  return supabase;
}
