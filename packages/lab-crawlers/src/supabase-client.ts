import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type LabCrawlerSupabaseClient = SupabaseClient<any>;

export function createLabCrawlerSupabaseClient(env = process.env): LabCrawlerSupabaseClient {
  const supabaseUrl = env.SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for Supabase-backed lab crawler commands');
  }

  return createClient<any>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
